import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import CustomError from '../utils/customError.js';

function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new CustomError(400, 'Validation failed.', details);
    }
    req.body = result.data;
    next();
  };
}

export default validateBody;
