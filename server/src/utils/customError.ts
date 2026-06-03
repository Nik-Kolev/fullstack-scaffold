class CustomError extends Error {
	statusCode: number;
	isOperational: boolean = true;
	details?: unknown;

	constructor(statusCode: number, message: string, details?: unknown) {
		super(message);
		this.statusCode = statusCode;
		this.details = details;
		Error.captureStackTrace(this, this.constructor);
	}
}

export default CustomError;
