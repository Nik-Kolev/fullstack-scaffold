import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import redis, { acquireLock, releaseLock } from '../lib/redis.js';
import stripe from '../lib/stripe.js';

vi.mock('../lib/bullmq.js', () => ({ emailQueue: { add: vi.fn() } }));

vi.mock('../lib/stripe.js', () => ({
	default: {
		customers: { create: vi.fn() },
		checkout: {
			sessions: {
				create: vi.fn(),
				retrieve: vi.fn(),
			},
		},
		webhooks: { constructEvent: vi.fn() },
	},
}));

const TEST_USER = { email: 'pay-test@example.com', password: 'Test1234', name: 'Payer' };
let PRODUCT_ID = 0;
let categoryId = 0;
const SESSION_ID = 'cs_test_abc123';
const SESSION_URL = 'https://checkout.stripe.com/pay/cs_test_abc123';
const CUSTOMER_ID = 'cus_test_123';
const PI_ID = 'pi_test_abc123';

async function registerAndLogin(): Promise<{ accessToken: string; userId: number }> {
	const regRes = await request(app).post('/api/auth/register').send(TEST_USER);
	const loginRes = await request(app)
		.post('/api/auth/login')
		.send({ email: TEST_USER.email, password: TEST_USER.password });
	return { accessToken: loginRes.body.accessToken, userId: regRes.body.user.id };
}

function checkoutReq(token: string, body?: object) {
	return request(app)
		.post('/api/payment/checkout')
		.set('Authorization', `Bearer ${token}`)
		.send(body ?? { productId: PRODUCT_ID, quantity: 1 });
}

async function sendWebhook(event: Record<string, unknown>) {
	const withId = { id: `evt_${crypto.randomUUID()}`, ...event };
	vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce(
		withId as unknown as Stripe.Event,
	);
	return request(app)
		.post('/api/payment/webhook')
		.set('stripe-signature', 'v1=test_sig')
		.set('Content-Type', 'application/json')
		.send(JSON.stringify(withId));
}

async function seedUser() {
	return prisma.user.create({
		data: { email: 'seed@example.com', name: 'Seed User', password: 'hashed' },
	});
}

async function seedPayment(userId: number, overrides: object = {}) {
	return prisma.payment.create({
		data: {
			userId,
			stripeSessionId: SESSION_ID,
			amountTotal: 1000,
			quantity: 1,
			currency: 'eur',
			...overrides,
		} as Parameters<typeof prisma.payment.create>[0]['data'],
	});
}

beforeEach(async () => {
	await prisma.like.deleteMany();
	await prisma.processedStripeEvent.deleteMany();
	await prisma.payment.deleteMany();
	await prisma.product.deleteMany();
	await prisma.productCategory.deleteMany();
	await prisma.userFile.deleteMany();
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
	await redis.flushdb();
	vi.resetAllMocks();
	vi.mocked(stripe.customers.create).mockResolvedValue({ id: CUSTOMER_ID } as any);
	vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
		id: SESSION_ID,
		url: SESSION_URL,
	} as any);
	const category = await prisma.productCategory.create({ data: { name: 'Test Category' } });
	categoryId = category.id;
	const product = await prisma.product.create({
		data: {
			name: 'Test Product',
			price: 1000,
			categoryId,
			color: 'black',
			shape: 'square',
		},
	});
	PRODUCT_ID = product.id;
});

afterAll(async () => {
	await prisma.$disconnect();
	await redis.quit();
});

// ─── POST /api/payment/checkout ──────────────────────────────────────────────

describe('POST /api/payment/checkout', () => {
	describe('auth guard', () => {
		it('returns 401 with no Authorization header', async () => {
			const res = await request(app)
				.post('/api/payment/checkout')
				.send({ productId: 1, quantity: 1 });
			expect(res.status).toBe(401);
		});
	});

	describe('validation', () => {
		it('returns 400 when productId is missing', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { quantity: 1 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when quantity is missing', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: PRODUCT_ID });
			expect(res.status).toBe(400);
		});

		it('returns 400 when productId is a float', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: 1.5, quantity: 1 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when productId is zero', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: 0, quantity: 1 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when productId is negative', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: -1, quantity: 1 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when productId is a numeric string', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: '1', quantity: 1 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when quantity is zero', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: PRODUCT_ID, quantity: 0 });
			expect(res.status).toBe(400);
		});

		it('returns 400 when quantity is negative', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: PRODUCT_ID, quantity: -1 });
			expect(res.status).toBe(400);
		});

		it('strips unknown fields and does not forward them to Stripe', async () => {
			const { accessToken } = await registerAndLogin();
			await checkoutReq(accessToken, {
				productId: PRODUCT_ID,
				quantity: 1,
				injectedField: 'DROP TABLE users',
			});
			const callArg = vi.mocked(stripe.checkout.sessions.create).mock.calls[0]?.[0];
			expect(JSON.stringify(callArg)).not.toContain('injectedField');
		});
	});

	describe('product lookup', () => {
		it('returns 404 when productId does not exist', async () => {
			const { accessToken } = await registerAndLogin();
			const res = await checkoutReq(accessToken, { productId: 99999, quantity: 1 });
			expect(res.status).toBe(404);
		});

		it('returns 404 when product is inactive', async () => {
			const { accessToken } = await registerAndLogin();
			const inactive = await prisma.product.create({
				data: {
					name: 'Gone',
					price: 500,
					isActive: false,
					categoryId,
					color: 'black',
					shape: 'square',
				},
			});
			const res = await checkoutReq(accessToken, { productId: inactive.id, quantity: 1 });
			expect(res.status).toBe(404);
		});
	});

	describe('happy path', () => {
		it('returns 201 with url and creates a PENDING payment row in DB', async () => {
			const { accessToken, userId } = await registerAndLogin();
			const res = await checkoutReq(accessToken);

			expect(res.status).toBe(201);
			expect(res.body).toEqual({ url: SESSION_URL });

			const payment = await prisma.payment.findUnique({
				where: { stripeSessionId: SESSION_ID },
			});
			expect(payment).toMatchObject({
				userId,
				amountTotal: 1000,
				quantity: 1,
				currency: 'eur',
				status: 'PENDING',
				description: 'Test Product',
			});
		});

		it('derives amountTotal from product.price × quantity', async () => {
			const { accessToken } = await registerAndLogin();
			await checkoutReq(accessToken, { productId: PRODUCT_ID, quantity: 3 });

			const payment = await prisma.payment.findUnique({
				where: { stripeSessionId: SESSION_ID },
			});
			expect(payment?.amountTotal).toBe(3000);
		});

		it('sends unit_amount as product.price (per-unit), not amountTotal — Stripe multiplies by quantity itself', async () => {
			const { accessToken } = await registerAndLogin();
			await checkoutReq(accessToken, { productId: PRODUCT_ID, quantity: 3 });

			const callArg = vi.mocked(stripe.checkout.sessions.create).mock.calls[0]?.[0];
			const lineItem = callArg?.line_items?.[0] as {
				price_data?: { unit_amount?: number };
				quantity?: number;
			};
			expect(lineItem.price_data?.unit_amount).toBe(1000);
			expect(lineItem.quantity).toBe(3);
		});
	});

	describe('concurrency', () => {
		it('returns 409 when the per-user checkout lock is already held, without touching Stripe', async () => {
			const { accessToken, userId } = await registerAndLogin();

			// Simulates another in-flight checkout request for this user by holding
			// the exact lock createCheckoutSession itself acquires — deterministic,
			// unlike racing two real HTTP requests against a fast local DB.
			const lockToken = await acquireLock(`lock:checkout:${userId}`, 10_000);
			expect(lockToken).not.toBeNull();

			try {
				const res = await checkoutReq(accessToken);

				expect(res.status).toBe(409);
				expect(vi.mocked(stripe.checkout.sessions.create)).not.toHaveBeenCalled();
			} finally {
				await releaseLock(`lock:checkout:${userId}`, lockToken!);
			}
		});

		it('succeeds once the lock is released', async () => {
			const { accessToken, userId } = await registerAndLogin();
			const lockToken = await acquireLock(`lock:checkout:${userId}`, 10_000);
			await releaseLock(`lock:checkout:${userId}`, lockToken!);

			const res = await checkoutReq(accessToken);
			expect(res.status).toBe(201);
		});
	});

	describe('Stripe customer lifecycle', () => {
		it('creates a Stripe customer on first checkout and persists stripeCustomerId on the user', async () => {
			const { accessToken, userId } = await registerAndLogin();
			await checkoutReq(accessToken);

			expect(vi.mocked(stripe.customers.create)).toHaveBeenCalledOnce();
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.stripeCustomerId).toBe(CUSTOMER_ID);
		});

		it('reuses stripeCustomerId on subsequent checkout — customers.create not called again', async () => {
			const { accessToken } = await registerAndLogin();

			vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({
				id: 'cs_first',
				url: 'https://checkout.stripe.com/pay/cs_first',
			} as any);
			await checkoutReq(accessToken);

			vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValueOnce({
				status: 'expired',
				url: null,
			} as any);
			vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({
				id: 'cs_second',
				url: SESSION_URL,
			} as any);
			await checkoutReq(accessToken);

			expect(vi.mocked(stripe.customers.create)).toHaveBeenCalledOnce();
		});
	});

	describe('pending session guard', () => {
		it('returns the open session URL even when a different product is requested — guard is per-user, not per-product', async () => {
			const { accessToken, userId } = await registerAndLogin();
			const existingUrl = 'https://checkout.stripe.com/pay/existing';
			const otherProduct = await prisma.product.create({
				data: {
					name: 'Other Product',
					price: 500,
					categoryId,
					color: 'black',
					shape: 'square',
				},
			});
			await seedPayment(userId, { status: 'PENDING' });

			vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValueOnce({
				status: 'open',
				url: existingUrl,
			} as any);

			const res = await checkoutReq(accessToken, { productId: otherProduct.id, quantity: 1 });

			expect(res.status).toBe(201);
			expect(res.body).toEqual({ url: existingUrl });
			expect(vi.mocked(stripe.checkout.sessions.create)).not.toHaveBeenCalled();
		});

		it('returns existing url without creating a new session when PENDING session is still open', async () => {
			const { accessToken, userId } = await registerAndLogin();
			const existingUrl = 'https://checkout.stripe.com/pay/existing';
			await seedPayment(userId, { status: 'PENDING' });

			vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValueOnce({
				status: 'open',
				url: existingUrl,
			} as any);

			const res = await checkoutReq(accessToken);

			expect(res.status).toBe(201);
			expect(res.body).toEqual({ url: existingUrl });
			expect(vi.mocked(stripe.checkout.sessions.create)).not.toHaveBeenCalled();
		});

		it('marks expired PENDING session as FAILED and creates a fresh session', async () => {
			const { accessToken, userId } = await registerAndLogin();
			const stale = await seedPayment(userId, { status: 'PENDING' });

			vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValueOnce({
				status: 'expired',
				url: null,
			} as any);
			vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({
				id: 'cs_fresh',
				url: 'https://checkout.stripe.com/pay/fresh',
			} as any);

			const res = await checkoutReq(accessToken);

			expect(res.status).toBe(201);
			expect(res.body.url).toBe('https://checkout.stripe.com/pay/fresh');

			const old = await prisma.payment.findUnique({ where: { id: stale.id } });
			expect(old?.status).toBe('FAILED');

			const fresh = await prisma.payment.findUnique({
				where: { stripeSessionId: 'cs_fresh' },
			});
			expect(fresh?.status).toBe('PENDING');
		});
	});

	describe('error paths', () => {
		it('returns 500 when Stripe session has no url', async () => {
			const { accessToken } = await registerAndLogin();
			vi.mocked(stripe.checkout.sessions.create).mockResolvedValueOnce({
				id: 'cs_no_url',
				url: null,
			} as any);

			const res = await checkoutReq(accessToken);
			expect(res.status).toBe(500);
		});

		it('releases the lock after a Stripe error — the next attempt is not stuck behind it', async () => {
			const { accessToken } = await registerAndLogin();
			vi.mocked(stripe.checkout.sessions.create).mockRejectedValueOnce(
				new Error('Stripe down'),
			);

			const failed = await checkoutReq(accessToken);
			expect(failed.status).toBe(500);

			const retried = await checkoutReq(accessToken);
			expect(retried.status).toBe(201);
		});
	});
});

// ─── POST /api/payment/webhook ───────────────────────────────────────────────

describe('POST /api/payment/webhook', () => {
	describe('signature verification', () => {
		it('returns 400 when stripe-signature header is missing', async () => {
			const res = await request(app)
				.post('/api/payment/webhook')
				.set('Content-Type', 'application/json')
				.send('{}');
			expect(res.status).toBe(400);
		});

		it('returns 400 when constructEvent throws — tampered payload or wrong secret', async () => {
			vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce(() => {
				throw new Error('No signatures found matching the expected signature for payload.');
			});

			const res = await request(app)
				.post('/api/payment/webhook')
				.set('stripe-signature', 'v1=bad_sig')
				.set('Content-Type', 'application/json')
				.send('{"tampered":"payload"}');
			expect(res.status).toBe(400);
		});
	});

	describe('checkout.session.completed', () => {
		it('updates payment to SUCCEEDED and stores stripePaymentIntentId', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({
				type: 'checkout.session.completed',
				data: {
					object: {
						id: SESSION_ID,
						payment_intent: PI_ID,
						payment_status: 'paid',
					} as any,
				},
			});

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ received: true });

			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('SUCCEEDED');
			expect(updated?.stripePaymentIntentId).toBe(PI_ID);
		});

		it('updates to SUCCEEDED with no paymentIntentId when payment_intent is null but the session is paid', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({
				type: 'checkout.session.completed',
				data: {
					object: { id: SESSION_ID, payment_intent: null, payment_status: 'paid' } as any,
				},
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('SUCCEEDED');
			expect(updated?.stripePaymentIntentId).toBeNull();
		});

		it('leaves the payment PENDING when the session completed but is still unpaid', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({
				type: 'checkout.session.completed',
				data: {
					object: {
						id: SESSION_ID,
						payment_intent: PI_ID,
						payment_status: 'unpaid',
					} as any,
				},
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('PENDING');
		});

		it('marks SUCCEEDED when the delayed payment later succeeds', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({
				type: 'checkout.session.async_payment_succeeded',
				data: {
					object: {
						id: SESSION_ID,
						payment_intent: PI_ID,
						payment_status: 'paid',
					} as any,
				},
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('SUCCEEDED');
		});

		it('marks FAILED when the delayed payment later bounces', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({
				type: 'checkout.session.async_payment_failed',
				data: { object: { id: SESSION_ID, payment_status: 'unpaid' } as any },
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('FAILED');
		});

		it('is idempotent for an already-SUCCEEDED payment — does not overwrite stripePaymentIntentId', async () => {
			const user = await seedUser();
			await seedPayment(user.id, { status: 'SUCCEEDED', stripePaymentIntentId: PI_ID });

			const res = await sendWebhook({
				type: 'checkout.session.completed',
				data: {
					object: { id: SESSION_ID, payment_intent: 'pi_second_attempt' } as any,
				},
			});

			expect(res.status).toBe(200);
			const payment = await prisma.payment.findUnique({
				where: { stripeSessionId: SESSION_ID },
			});
			expect(payment?.status).toBe('SUCCEEDED');
			expect(payment?.stripePaymentIntentId).toBe(PI_ID);
		});
	});

	describe('checkout.session.expired', () => {
		it('updates payment to FAILED', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({
				type: 'checkout.session.expired',
				data: { object: { id: SESSION_ID } as any },
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('FAILED');
		});
	});

	describe('charge.refunded', () => {
		it('full refund (amount_refunded === amount) → REFUNDED with refundedAt and refundedAmountTotal', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, {
				status: 'SUCCEEDED',
				stripePaymentIntentId: PI_ID,
			});

			const res = await sendWebhook({
				type: 'charge.refunded',
				data: {
					object: {
						payment_intent: PI_ID,
						amount: 1000,
						amount_refunded: 1000,
					} as any,
				},
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('REFUNDED');
			expect(updated?.refundedAmountTotal).toBe(1000);
			expect(updated?.refundedAt).not.toBeNull();
		});

		it('partial refund (amount_refunded < amount) → PARTIALLY_REFUNDED', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, {
				status: 'SUCCEEDED',
				stripePaymentIntentId: PI_ID,
			});

			const res = await sendWebhook({
				type: 'charge.refunded',
				data: {
					object: {
						payment_intent: PI_ID,
						amount: 1000,
						amount_refunded: 400,
					} as any,
				},
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('PARTIALLY_REFUNDED');
			expect(updated?.refundedAmountTotal).toBe(400);
		});

		it('is idempotent for an already-REFUNDED payment — does not overwrite refundedAt', async () => {
			const user = await seedUser();
			const originalRefundedAt = new Date('2024-01-01T00:00:00Z');
			await seedPayment(user.id, {
				status: 'REFUNDED',
				stripePaymentIntentId: PI_ID,
				refundedAt: originalRefundedAt,
				refundedAmountTotal: 1000,
			});

			const res = await sendWebhook({
				type: 'charge.refunded',
				data: {
					object: {
						payment_intent: PI_ID,
						amount: 1000,
						amount_refunded: 1000,
					} as any,
				},
			});

			expect(res.status).toBe(200);
			const payment = await prisma.payment.findFirst({
				where: { stripePaymentIntentId: PI_ID },
			});
			expect(payment?.status).toBe('REFUNDED');
			expect(payment?.refundedAt?.toISOString()).toBe(originalRefundedAt.toISOString());
		});

		it('ignores a refund webhook whose amount does not exceed the already-recorded refundedAmountTotal — stale/out-of-order delivery', async () => {
			const user = await seedUser();
			await seedPayment(user.id, {
				status: 'PARTIALLY_REFUNDED',
				stripePaymentIntentId: PI_ID,
				refundedAmountTotal: 600,
			});

			const res = await sendWebhook({
				type: 'charge.refunded',
				data: {
					object: {
						payment_intent: PI_ID,
						amount: 1000,
						amount_refunded: 400,
					} as any,
				},
			});

			expect(res.status).toBe(200);
			const payment = await prisma.payment.findFirst({
				where: { stripePaymentIntentId: PI_ID },
			});
			expect(payment?.status).toBe('PARTIALLY_REFUNDED');
			expect(payment?.refundedAmountTotal).toBe(600);
		});

		it('skips silently when payment_intent is an expanded object instead of a string ID — Stripe expand[] API', async () => {
			const user = await seedUser();
			await seedPayment(user.id, { status: 'SUCCEEDED', stripePaymentIntentId: PI_ID });

			const res = await sendWebhook({
				type: 'charge.refunded',
				data: {
					object: {
						payment_intent: { id: PI_ID, object: 'payment_intent' },
						amount: 1000,
						amount_refunded: 1000,
					} as unknown as any,
				},
			});

			expect(res.status).toBe(200);
			const payment = await prisma.payment.findFirst({
				where: { stripePaymentIntentId: PI_ID },
			});
			expect(payment?.status).toBe('SUCCEEDED');
		});
	});

	describe('edge cases', () => {
		it('unknown event type → 200 with no DB changes', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({ type: 'invoice.payment_succeeded' });

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ received: true });
			const unchanged = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(unchanged?.status).toBe('PENDING');
		});

		it('checkout.session.completed for unknown session → 404, causes Stripe to retry in production', async () => {
			const res = await sendWebhook({
				type: 'checkout.session.completed',
				data: {
					object: {
						id: 'cs_ghost_unknown',
						payment_intent: 'pi_ghost',
						payment_status: 'paid',
					} as any,
				},
			});
			expect(res.status).toBe(404);
		});

		it('records each event id once so a redelivery is skipped', async () => {
			const user = await seedUser();
			await seedPayment(user.id, { status: 'PENDING' });

			const eventId = `evt_${crypto.randomUUID()}`;
			const event = {
				id: eventId,
				type: 'checkout.session.completed',
				data: {
					object: {
						id: SESSION_ID,
						payment_intent: PI_ID,
						payment_status: 'paid',
					} as any,
				},
			};

			await sendWebhook(event);
			const second = await sendWebhook(event);

			expect(second.status).toBe(200);
			const rows = await prisma.processedStripeEvent.findMany({ where: { eventId } });
			expect(rows).toHaveLength(1);
		});

		it('marks a payment DISPUTED when a chargeback is opened', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, {
				status: 'SUCCEEDED',
				stripePaymentIntentId: PI_ID,
			});

			const res = await sendWebhook({
				type: 'charge.dispute.created',
				data: { object: { payment_intent: PI_ID } as any },
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('DISPUTED');
		});

		it('charge.refunded for unknown paymentIntentId → 404', async () => {
			const res = await sendWebhook({
				type: 'charge.refunded',
				data: {
					object: {
						payment_intent: 'pi_ghost',
						amount: 500,
						amount_refunded: 500,
					} as any,
				},
			});
			expect(res.status).toBe(404);
		});

		it('duplicate checkout.session.completed → 200 on both calls — Stripe at-least-once delivery', async () => {
			const user = await seedUser();
			await seedPayment(user.id, { status: 'PENDING' });

			const event: Partial<Stripe.Event> = {
				type: 'checkout.session.completed',
				data: {
					object: {
						id: SESSION_ID,
						payment_intent: PI_ID,
						payment_status: 'paid',
					} as any,
				},
			};

			const first = await sendWebhook(event);
			const second = await sendWebhook(event);

			expect(first.status).toBe(200);
			expect(second.status).toBe(200);

			const payment = await prisma.payment.findUnique({
				where: { stripeSessionId: SESSION_ID },
			});
			expect(payment?.status).toBe('SUCCEEDED');
		});
	});
});
