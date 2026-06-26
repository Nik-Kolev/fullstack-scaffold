import type { NextFunction, Request, Response } from 'express';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';
import redis from '../lib/redis.js';

export async function isAuth(req: Request, _res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization;
	const [scheme, token] = authHeader?.split(' ') ?? [];

	if (scheme !== 'Bearer' || !token) {
		throw new CustomError(401, 'Unauthorized.');
	}

	const payload = JWT.verifyToken('access', token);

	const blacklisted = await redis.get(`blacklist:${payload.jti}`);
	if (blacklisted) throw new CustomError(401, 'Unauthorized.');

	req.user = {
		userId: payload.userId,
		email: payload.email,
		role: payload.role,
		jti: payload.jti as string,
		exp: payload.exp as number,
	};

	next();
}
