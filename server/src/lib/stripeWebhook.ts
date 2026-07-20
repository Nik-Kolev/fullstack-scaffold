import Stripe from 'stripe';
import prisma from './prisma.js';
import {
	updatePaymentByPaymentIntentId,
	updatePaymentBySessionId,
} from '../services/paymentService.js';

const handleEvent = async (event: Stripe.Event): Promise<void> => {
	switch (event.type) {
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded': {
			const session = event.data.object as Stripe.Checkout.Session;

			// 'completed' is not 'paid' — delayed methods (SEPA, Boleto) fire it while unpaid,
			// and settle later via async_payment_succeeded/failed.
			if (session.payment_status !== 'paid') return;

			await updatePaymentBySessionId(session.id, {
				status: 'SUCCEEDED',
				...(typeof session.payment_intent === 'string' && {
					stripePaymentIntentId: session.payment_intent,
				}),
			});
			break;
		}

		case 'checkout.session.async_payment_failed':
		case 'checkout.session.expired': {
			const session = event.data.object as Stripe.Checkout.Session;
			await updatePaymentBySessionId(session.id, { status: 'FAILED' });
			break;
		}

		case 'charge.refunded': {
			const charge = event.data.object as Stripe.Charge;
			const paymentIntentId =
				typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

			if (!paymentIntentId) return;

			await updatePaymentByPaymentIntentId(paymentIntentId, {
				status:
					charge.amount_refunded === charge.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
				refundedAt: new Date(),
				refundedAmountTotal: charge.amount_refunded,
			});
			break;
		}

		case 'charge.dispute.created': {
			const dispute = event.data.object as Stripe.Dispute;
			const paymentIntentId =
				typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null;

			if (!paymentIntentId) return;

			await updatePaymentByPaymentIntentId(paymentIntentId, { status: 'DISPUTED' });
			break;
		}

		case 'payment_intent.payment_failed': {
			const intent = event.data.object as Stripe.PaymentIntent;
			console.error(
				`[stripe] payment_intent ${intent.id} failed: ${intent.last_payment_error?.message ?? 'no reason given'}`,
			);
			break;
		}

		default:
			return;
	}
};

export const handleStripeEvent = async (event: Stripe.Event): Promise<void> => {
	if (!event.id) {
		await handleEvent(event);
		return;
	}

	const alreadyProcessed = await prisma.processedStripeEvent.findUnique({
		where: { eventId: event.id },
	});
	if (alreadyProcessed) return;

	await handleEvent(event);

	await prisma.processedStripeEvent
		.create({ data: { eventId: event.id, type: event.type } })
		.catch(() => {});
};
