import prisma from '../lib/prisma.js';
import stripe from '../lib/stripe.js';
import CustomError from '../utils/customError.js';

const getOrCreateStripeCustomer = async (
	userId: number,
	email: string,
	name: string,
): Promise<string> => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { stripeCustomerId: true },
	});

	if (!user) throw new CustomError(404, 'User not found.');
	if (user.stripeCustomerId) return user.stripeCustomerId;

	const customer = await stripe.customers.create({ email, name });

	await prisma.user.update({
		where: { id: userId },
		data: { stripeCustomerId: customer.id },
	});

	return customer.id;
};

export const createCheckoutSession = async (
	userId: number,
	amountTotal: number,
	quantity: number,
	description?: string,
) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) throw new CustomError(404, 'User not found.');

	const existingPending = await prisma.payment.findFirst({
		where: { userId, status: 'PENDING' },
		orderBy: { createdAt: 'desc' },
	});

	if (existingPending) {
		const session = await stripe.checkout.sessions.retrieve(existingPending.stripeSessionId);

		if (session.status === 'open') return { url: session.url! };

		await prisma.payment.update({
			where: { id: existingPending.id },
			data: { status: 'FAILED' },
		});
	}

	const stripeCustomerId =
		user.stripeCustomerId ?? (await getOrCreateStripeCustomer(userId, user.email, user.name));

	const session = await stripe.checkout.sessions.create({
		customer: stripeCustomerId,
		mode: 'payment',
		line_items: [
			{
				price_data: {
					currency: 'eur',
					unit_amount: amountTotal,
					product_data: { name: description ?? 'Payment' },
				},
				quantity,
			},
		],
		success_url: `${process.env.ORIGIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${process.env.ORIGIN}/payment/cancel`,
	});

	if (!session.url) throw new CustomError(500, 'Failed to create Stripe checkout session.');

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

	return { url: session.url };
};

export const updatePaymentBySessionId = async (
	sessionId: string,
	data: {
		status: 'SUCCEEDED' | 'FAILED';
		stripePaymentIntentId?: string;
	},
) => {
	const payment = await prisma.payment.findUnique({
		where: { stripeSessionId: sessionId },
	});

	if (!payment) throw new CustomError(404, 'Payment not found.');

	return prisma.payment.update({
		where: { id: payment.id },
		data,
	});
};

export const updatePaymentByPaymentIntentId = async (
	paymentIntentId: string,
	data: {
		status: 'REFUNDED' | 'PARTIALLY_REFUNDED';
		refundedAt: Date;
		refundedAmountTotal: number;
	},
) => {
	const payment = await prisma.payment.findUnique({
		where: { stripePaymentIntentId: paymentIntentId },
	});

	if (!payment) throw new CustomError(404, 'Payment not found.');

	return prisma.payment.update({
		where: { id: payment.id },
		data,
	});
};
