import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
	apiVersion: '2026-05-27.dahlia',
	typescript: true,
});

export default stripe;
