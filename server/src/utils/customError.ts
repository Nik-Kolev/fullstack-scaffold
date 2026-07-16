class CustomError extends Error {
	statusCode: number;
	isOperational: boolean = true;
	code?: string | undefined;
	details?: unknown;

	constructor(statusCode: number, message: string, code?: string, details?: unknown) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
		Error.captureStackTrace(this, this.constructor);
	}
}

export default CustomError;
