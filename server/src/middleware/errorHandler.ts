import CustomError from '../utils/customError.js';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/index.js';

const PRISMA_ERROR_MAP: Record<string, { statusCode: number; message: string }> = {
  P2000: { statusCode: 400, message: 'Input value is too long.' },
  P2002: { statusCode: 409, message: 'A record with this value already exists.' },
  P2003: { statusCode: 400, message: 'Related record not found.' },
  P2011: { statusCode: 400, message: 'A required field is missing.' },
  P2025: { statusCode: 404, message: 'Record not found.' },
};

function extractPrismaMeta(meta: unknown): unknown {
  if (!meta || typeof meta !== 'object') return undefined;
  const m = meta as Record<string, unknown>;
  const fields = (m.driverAdapterError as any)?.cause?.constraint?.fields ?? m.target;
  return fields ? { fields } : undefined;
}

function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  let message = 'Internal server error';
  let statusCode = 500;
  let details: unknown;

  if (error instanceof CustomError) {
    message = error.message;
    statusCode = error.statusCode;
    details = error.details;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[error.code];
    if (mapped) {
      message = mapped.message;
      statusCode = mapped.statusCode;
      details = extractPrismaMeta(error.meta);
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    message = 'Invalid request data.';
    statusCode = 400;
    details = error.message.split('\n').at(-1)?.trim();
  } else if (error instanceof Error) {
    message = error.message;
  }

  console.error(`[${req.method}] ${req.path} >> ${statusCode} >> ${message}`);

  res.status(statusCode).json({ message, details });
}

export default errorHandler;
