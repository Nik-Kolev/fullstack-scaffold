import z from 'zod';

export const updateMeSchema = z
	.object({
		name: z.string().min(1).optional(),
		email: z.email().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: 'At least one field must be provided.',
	});
