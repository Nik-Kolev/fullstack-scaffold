import CustomError from '../utils/customError.js';
import type { Request, Response, NextFunction } from 'express';

function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  let message = 'Internal server error';
  let statusCode = 500;
  let details: unknown;

  if (error instanceof CustomError) {
    message = error.message;
    statusCode = error.statusCode;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
  }

  console.error(`[${req.method}] ${req.path} >> ${statusCode} >> ${message}`);

  res.status(statusCode).json({ message, details });
}

export default errorHandler;
