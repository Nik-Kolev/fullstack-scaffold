import z from 'zod';

export const createProductSchema = z.object({
	name: z.string().min(1),
	description: z.string().min(1).optional(),
	price: z.number().int().positive(),
	imageUrl: z.string().url().optional(),
});

export const updateProductSchema = createProductSchema
	.partial()
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field must be provided.',
	});
