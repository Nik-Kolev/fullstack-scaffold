import type { NextFunction, Request, Response } from 'express';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';

export function isAuth(req: Request, _res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization;
	const token = authHeader?.split(' ')[1];

	if (!token) {
		throw new CustomError(401, 'Unauthorized.');
	}

	const payload = JWT.verifyToken('access', token);

	req.user = { userId: payload.userId, email: payload.email, role: payload.role };

	next();
}
