declare namespace Express {
	interface Request {
		user?: { userId: number; email: string; role: string; jti: string; exp: number };
	}
}
