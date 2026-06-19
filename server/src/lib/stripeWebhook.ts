import Stripe from 'stripe';
import {
	updatePaymentByPaymentIntentId,
	updatePaymentBySessionId,
} from '../services/paymentService.js';

export const handleStripeEvent = async (event: Stripe.Event): Promise<void> => {
	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;
			await updatePaymentBySessionId(session.id, {
				status: 'SUCCEEDED',
				...(typeof session.payment_intent === 'string' && {
					stripePaymentIntentId: session.payment_intent,
				}),
			});
			break;
		}

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

		default:
			return;
	}
};
