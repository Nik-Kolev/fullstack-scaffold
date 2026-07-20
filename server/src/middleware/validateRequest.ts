import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import CustomError from '../utils/customError.js';

function validate(schema: ZodType, from: 'body' | 'query') {
	return (req: Request, _res: Response, next: NextFunction) => {
		const result = schema.safeParse(req[from]);
		if (!result.success) {
			const details = result.error.issues.map((e) => ({
				field: e.path.join('.'),
				message: e.message,
			}));
			throw new CustomError(400, 'Validation failed.', 'VALIDATION_ERROR', details);
		}
		// Express 5 makes req.query getter-only, so the parsed result is parked elsewhere.
		if (from === 'body') req.body = result.data;
		else req.validatedQuery = result.data as Record<string, unknown>;

		next();
	};
}

export const validateBody = (schema: ZodType) => validate(schema, 'body');
export const validateQuery = (schema: ZodType) => validate(schema, 'query');
