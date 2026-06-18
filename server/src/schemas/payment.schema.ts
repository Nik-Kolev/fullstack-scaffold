import z from 'zod';

export const createCheckoutSessionSchema = z.object({
	amountTotal: z.number().int().positive(),
	quantity: z.number().int().positive(),
	description: z.string().min(1).optional(),
});
