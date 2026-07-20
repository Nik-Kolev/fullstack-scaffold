import type { Request, Response, NextFunction } from 'express';
import CustomError from '../utils/customError.js';

export function requireRole(...neededRole: string[]) {
	return function (req: Request, _res: Response, next: NextFunction) {
		if (!req.user?.role || !neededRole.includes(req.user?.role))
			throw new CustomError(403, 'Forbidden.', 'FORBIDDEN');
		next();
	};
}
