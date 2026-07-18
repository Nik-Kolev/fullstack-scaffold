import z from 'zod';

export const productQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
});

export const createProductSchema = z.object({
	name: z.string().min(1),
	description: z.string().min(1).optional(),
	price: z.coerce.number().int().positive(),
	imageUrl: z.string().url().optional(),
	categoryId: z.coerce.number().int().positive(),
	quantity: z.coerce.number().int().nonnegative().optional(),
	discountPercent: z.coerce.number().int().min(0).max(100).optional(),
	color: z.string().min(1),
	shape: z.string().min(1),
});

export const updateProductSchema = createProductSchema
	.partial()
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field must be provided.',
	});
