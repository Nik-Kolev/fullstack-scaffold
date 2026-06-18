import { rateLimit } from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import CustomError from '../utils/customError.js';

const handler = (_req: Request, _res: Response, next: NextFunction) => {
	next(new CustomError(429, 'Too many requests, please try again later.'));
};

const skip = () => process.env.NODE_ENV === 'test';

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	handler,
	skip,
});

export const generalLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 100,
	handler,
	skip,
});

export const uploadLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	handler,
	skip,
});

export const checkoutLimiter = rateLimit({
	windowMs: 5 * 1000,
	limit: 1,
	keyGenerator: (req) => String(req.user!.userId),
	handler,
	skip,
});
