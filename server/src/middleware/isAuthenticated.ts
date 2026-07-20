import type { NextFunction, Request, Response } from 'express';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';
import redis, { tokensValidAfterKey } from '../lib/redis.js';

export async function isAuth(req: Request, _res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization;
	const [scheme, token] = authHeader?.split(' ') ?? [];

	if (scheme !== 'Bearer' || !token) {
		throw new CustomError(401, 'Unauthorized.', 'NO_TOKEN');
	}

	const payload = JWT.verifyToken('access', token);

	const blacklisted = await redis.get(`blacklist:${payload.jti}`);
	if (blacklisted) throw new CustomError(401, 'Unauthorized.', 'TOKEN_REVOKED');

	const validAfter = await redis.get(tokensValidAfterKey(payload.userId as number));
	if (validAfter && (payload.iat ?? 0) < Number(validAfter)) {
		throw new CustomError(401, 'Unauthorized.', 'TOKEN_REVOKED');
	}

	req.user = {
		userId: payload.userId,
		email: payload.email,
		role: payload.role,
		jti: payload.jti as string,
		exp: payload.exp as number,
	};

	next();
}
