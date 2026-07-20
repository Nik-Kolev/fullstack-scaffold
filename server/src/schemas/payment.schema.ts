import z from 'zod';

export const createCheckoutSessionSchema = z.object({
	productId: z.number().int().positive(),
	quantity: z.number().int().positive().max(100),
});
