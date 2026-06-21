import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import * as paymentService from '../services/paymentService.js';
import stripe from '../lib/stripe.js';
import { handleStripeEvent } from '../lib/stripeWebhook.js';
import CustomError from '../utils/customError.js';

export const createCheckoutSession = async (req: Request, res: Response) => {
	const { productId, quantity } = req.body;

	const { url } = await paymentService.createCheckoutSession(
		req.user!.userId,
		productId,
		quantity,
	);

	res.status(201).json({ url });
};

export const handleWebhook = async (req: Request, res: Response) => {
	const sig = req.headers['stripe-signature'] as string | undefined;
	if (!sig) throw new CustomError(400, 'Missing Stripe signature.');

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(
			req.body as Buffer,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET,
		);
	} catch {
		throw new CustomError(400, 'Webhook signature verification failed.');
	}

	await handleStripeEvent(event);
	res.status(200).json({ received: true });
};
