import z from 'zod';

const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

export const registerSchema = z.object({
	email: z.email('Invalid email format.'),
	password: z
		.string()
		.regex(
			passwordRegex,
			'Password must be at least 8 characters long, contain at least one letter and one number',
		),
	name: z.string().min(1, 'Name is required.'),
});

export const loginSchema = z.object({
	email: z.email('Invalid email format.'),
	password: z.string().min(1, 'Password is required.'),
});

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1).optional(),
		newPassword: z
			.string()
			.regex(
				passwordRegex,
				'Password must be at least 8 characters long, contain at least one letter and one number',
			),
	})
	.refine(
		(values) => {
			return values.currentPassword !== values.newPassword;
		},
		{
			message: 'New password must be different from your current password.',
			path: ['newPassword'],
		},
	);

export const emailSchema = z.object({
	email: z.email('Invalid email format.'),
});

export const resetPasswordSchema = z.object({
	token: z.string().min(1),
	newPassword: z
		.string()
		.regex(
			passwordRegex,
			'Password must be at least 8 characters long, contain at least one letter and one number',
		),
});

export const googleCodeSchema = z.object({
	code: z.string().uuid('Invalid OAuth code format.'),
});
