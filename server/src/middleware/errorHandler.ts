import CustomError from '../utils/customError.js';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/index.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const { JsonWebTokenError, TokenExpiredError } = jwt;

const PRISMA_ERROR_MAP: Record<string, { statusCode: number; message: string }> = {
	P2000: { statusCode: 400, message: 'Input value is too long.' },
	P2002: { statusCode: 409, message: 'A record with this value already exists.' },
	P2003: { statusCode: 400, message: 'Related record not found.' },
	P2011: { statusCode: 400, message: 'A required field is missing.' },
	P2020: { statusCode: 400, message: 'A value is out of range for its field.' },
	P2025: { statusCode: 404, message: 'Record not found.' },
};

const MULTER_ERROR_MAP: Record<string, { statusCode: number; message: string }> = {
	LIMIT_FILE_SIZE: { statusCode: 400, message: 'File is too large.' },
	LIMIT_UNEXPECTED_FILE: {
		statusCode: 400,
		message: 'Too many files, or unexpected field name.',
	},
};

// Keyed by the violated unique constraint's DB column names (snake_case,
// per @map — not the Prisma field names), sorted + joined so lookup is
// order-independent and scales to compound constraints without new branches.
const UNIQUE_CONSTRAINT_CODES: Record<string, { code: string; message: string }> = {
	email: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' },
	'product_id,user_id': {
		code: 'ALREADY_LIKED',
		message: 'You have already liked this product.',
	},
};

function extractPrismaFields(meta: unknown): unknown[] | undefined {
	if (!meta || typeof meta !== 'object') return undefined;
	const m = meta as Record<string, unknown>;
	const driverAdapterError = m.driverAdapterError as
		| { cause?: { constraint?: { fields?: unknown } } }
		| undefined;
	const fields = driverAdapterError?.cause?.constraint?.fields ?? m.target;
	return Array.isArray(fields) ? fields : undefined;
}

function mapUniqueConstraintError(meta: unknown) {
	const fields = extractPrismaFields(meta);
	if (!fields) return undefined;
	return UNIQUE_CONSTRAINT_CODES[fields.map(String).sort().join(',')];
}

export function errorHandler(
	error: unknown,
	req: Request,
	res: Response,
	_next: NextFunction,
): void {
	let message = 'Internal server error';
	let statusCode = 500;
	let code: string | undefined;
	let details: unknown;

	if (error instanceof CustomError) {
		message = error.message;
		statusCode = error.statusCode;
		code = error.code;
		details = error.details;
	} else if (error instanceof multer.MulterError) {
		const mapped = MULTER_ERROR_MAP[error.code];
		statusCode = mapped?.statusCode ?? 400;
		message = mapped?.message ?? error.message;
	} else if (error instanceof TokenExpiredError) {
		message = 'Session expired. Please log in again.';
		statusCode = 401;
		code = 'TOKEN_EXPIRED';
	} else if (error instanceof JsonWebTokenError) {
		message = 'Invalid token.';
		statusCode = 401;
		code = 'INVALID_TOKEN';
	} else if (error instanceof Prisma.PrismaClientKnownRequestError) {
		const mapped = PRISMA_ERROR_MAP[error.code];
		if (mapped) {
			message = mapped.message;
			statusCode = mapped.statusCode;
			if (error.code === 'P2002') {
				const specific = mapUniqueConstraintError(error.meta);
				if (specific) {
					code = specific.code;
					message = specific.message;
				}
			}
		}
	} else if (error instanceof Prisma.PrismaClientValidationError) {
		message = 'Invalid request data.';
		statusCode = 400;
	} else if (error instanceof Error) {
		message = error.message;
	}

	console.error(`[${req.method}] ${req.path} >> ${statusCode} >> ${message}`);

	res.status(statusCode).json({ statusCode, code, details });
}
