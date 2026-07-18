import z from 'zod';

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const productQuerySchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().positive().max(100).default(10),
	categoryId: z.coerce.number().int().positive().optional(),
	minPrice: z.coerce.number().int().positive().optional(),
	maxPrice: z.coerce.number().int().positive().optional(),
	color: z.string().min(1).optional(),
	shape: z.string().min(1).optional(),
	sortBy: z.enum(['price', 'likesCount']).optional(),
	order: z.enum(['asc', 'desc']).default('desc'),
});

export const createProductSchema = z.object({
	name: z.string().min(1),
	description: z.string().min(1).optional(),
	price: z.coerce.number().int().positive(),
	imageUrl: z.url().optional(),
	categoryId: z.coerce.number().int().positive(),
	quantity: z.coerce.number().int().nonnegative().optional(),
	discountPercent: z.coerce.number().int().min(0).max(100).optional(),
	color: z.string().min(1).transform(titleCase),
	shape: z.string().min(1).transform(titleCase),
});

export const updateProductSchema = createProductSchema
	.partial()
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field must be provided.',
	});
