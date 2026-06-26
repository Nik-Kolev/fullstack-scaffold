import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
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
	vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce(event as unknown as Stripe.Event);
	return request(app)
		.post('/api/payment/webhook')
		.set('stripe-signature', 'v1=test_sig')
		.set('Content-Type', 'application/json')
		.send(JSON.stringify(event));
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
	await prisma.payment.deleteMany();
	await prisma.product.deleteMany();
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
	const product = await prisma.product.create({ data: { name: 'Test Product', price: 1000 } });
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
				data: { name: 'Gone', price: 500, isActive: false },
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
				data: { name: 'Other Product', price: 500 },
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
					object: { id: SESSION_ID, payment_intent: PI_ID } as any,
				},
			});

			expect(res.status).toBe(200);
			expect(res.body).toEqual({ received: true });

			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('SUCCEEDED');
			expect(updated?.stripePaymentIntentId).toBe(PI_ID);
		});

		it('updates to SUCCEEDED with no paymentIntentId when payment_intent is null — async payment methods (e.g. SEPA)', async () => {
			const user = await seedUser();
			const payment = await seedPayment(user.id, { status: 'PENDING' });

			const res = await sendWebhook({
				type: 'checkout.session.completed',
				data: {
					object: { id: SESSION_ID, payment_intent: null } as any,
				},
			});

			expect(res.status).toBe(200);
			const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
			expect(updated?.status).toBe('SUCCEEDED');
			expect(updated?.stripePaymentIntentId).toBeNull();
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
					object: { id: 'cs_ghost_unknown', payment_intent: 'pi_ghost' } as any,
				},
			});
			expect(res.status).toBe(404);
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
					object: { id: SESSION_ID, payment_intent: PI_ID } as any,
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
