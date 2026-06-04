import { rateLimit } from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import CustomError from '../utils/customError.js';

const handler = (_req: Request, _res: Response, next: NextFunction) => {
	next(new CustomError(429, 'Too many requests, please try again later.'));
};

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	handler,
});

export const generalLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 100,
	handler,
});
