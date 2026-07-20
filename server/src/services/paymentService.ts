import prisma from '../lib/prisma.js';
import { acquireLock, releaseLock } from '../lib/redis.js';
import stripe from '../lib/stripe.js';
import CustomError from '../utils/customError.js';

const CHECKOUT_LOCK_TTL_MS = 10000;

// Only ever called when the caller has already confirmed stripeCustomerId is empty.
const createStripeCustomer = async (
	userId: number,
	email: string,
	name: string,
): Promise<string> => {
	const customer = await stripe.customers.create({ email, name });

	await prisma.user.update({
		where: { id: userId },
		data: { stripeCustomerId: customer.id },
	});

	return customer.id;
};

export const createCheckoutSession = async (
	userId: number,
	productId: number,
	quantity: number,
) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) throw new CustomError(404, 'User not found.');

	const product = await prisma.product.findUnique({ where: { id: productId } });
	if (!product || !product.isActive) throw new CustomError(404, 'Product not found.');

	const amountTotal = product.price * quantity;
	const description = product.name;

	// Serializes the check-then-act below per user — otherwise two concurrent checkout
	// calls can both pass the existingPending check and create duplicate sessions/rows.
	const lockKey = `lock:checkout:${userId}`;
	const lockToken = await acquireLock(lockKey, CHECKOUT_LOCK_TTL_MS);
	if (!lockToken) throw new CustomError(409, 'A checkout session is already being created.');

	try {
		const existingPending = await prisma.payment.findFirst({
			where: { userId, status: 'PENDING' },
			orderBy: { createdAt: 'desc' },
		});

		if (existingPending) {
			const session = await stripe.checkout.sessions.retrieve(
				existingPending.stripeSessionId,
			);

			if (session.status === 'open') return { url: session.url! };

			await prisma.payment.update({
				where: { id: existingPending.id },
				data: { status: 'FAILED' },
			});
		}

		const stripeCustomerId =
			user.stripeCustomerId ?? (await createStripeCustomer(userId, user.email, user.name));

		const session = await stripe.checkout.sessions.create({
			customer: stripeCustomerId,
			mode: 'payment',
			line_items: [
				{
					price_data: {
						currency: 'eur',
						unit_amount: product.price,
						product_data: { name: description ?? 'Payment' },
					},
					quantity,
				},
			],
			success_url: `${process.env.ORIGIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.ORIGIN}/payment/cancel`,
		});

		if (!session.url) throw new CustomError(500, 'Failed to create Stripe checkout session.');

		try {
			await prisma.payment.create({
				data: {
					userId,
					stripeSessionId: session.id,
					amountTotal,
					quantity,
					currency: 'eur',
					description: description ?? null,
				},
			});
		} catch (err) {
			await stripe.checkout.sessions.expire(session.id).catch(() => {});
			throw err;
		}

		return { url: session.url };
	} finally {
		await releaseLock(lockKey, lockToken);
	}
};

export const updatePaymentBySessionId = async (
	sessionId: string,
	data: {
		status: 'SUCCEEDED' | 'FAILED';
		stripePaymentIntentId?: string;
	},
) => {
	const updated = await prisma.payment.updateMany({
		where: { stripeSessionId: sessionId, status: 'PENDING' },
		data,
	});

	if (updated.count > 0) return;

	const exists = await prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
	if (!exists) throw new CustomError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');
};

export const updatePaymentByPaymentIntentId = async (
	paymentIntentId: string,
	data: {
		status: 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'DISPUTED';
		refundedAt?: Date;
		refundedAmountTotal?: number;
	},
) => {
	const updated = await prisma.payment.updateMany({
		where: {
			stripePaymentIntentId: paymentIntentId,
			status: { not: 'REFUNDED' },
			...(data.refundedAmountTotal !== undefined && {
				OR: [
					{ refundedAmountTotal: null },
					{ refundedAmountTotal: { lt: data.refundedAmountTotal } },
				],
			}),
		},
		data,
	});

	if (updated.count > 0) return;

	const exists = await prisma.payment.findUnique({
		where: { stripePaymentIntentId: paymentIntentId },
	});
	if (!exists) throw new CustomError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');
};
