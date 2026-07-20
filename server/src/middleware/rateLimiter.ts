import { rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { NextFunction, Request, Response } from 'express';
import CustomError from '../utils/customError.js';
import redis from '../lib/redis.js';

const handler = (_req: Request, _res: Response, next: NextFunction) => {
	next(new CustomError(429, 'Too many requests, please try again later.', 'RATE_LIMITED'));
};

const skip = () => process.env.NODE_ENV !== 'production';

const makeStore = (prefix: string) =>
	new RedisStore({
		sendCommand: (command: string, ...args: string[]) =>
			redis.call(command, ...args) as Promise<RedisReply>,
		prefix,
	});

export const generalLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 100,
	store: makeStore('rl:general:'),
	handler,
	skip,
});

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	store: makeStore('rl:auth:'),
	handler,
	skip,
});

export const uploadLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	store: makeStore('rl:upload:'),
	handler,
	skip,
});

export const checkoutLimiter = rateLimit({
	windowMs: 5 * 1000,
	limit: 1,
	keyGenerator: (req) => String(req.user!.userId),
	store: makeStore('rl:checkout:'),
	handler,
	skip,
});
