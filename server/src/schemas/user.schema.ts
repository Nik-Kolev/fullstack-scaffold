import z from 'zod';

const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

export const registerSchema = z.object({
  email: z.email('Invalid email format.'),
  password: z.string().regex(passwordRegex, 'Password must be at least 8 characters long, contain at least one letter and one number'),
  name: z.string().min(1, 'Name is required.').optional(),
});

export const loginSchema = z.object({
  email: z.email('Invalid email format.'),
  password: z.string().min(1, 'Password is required.'),
});
