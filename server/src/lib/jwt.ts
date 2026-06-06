import jwt, { type JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';

type TokenType = 'access' | 'refresh';

type TokenData = {
	id: string | number;
	email: string;
	role: string;
};

type TokenResult = {
	token: string;
	expiryDate: Date;
	refreshTokenId?: string;
};

const EXPIRY_SECONDS = {
	access: 15 * 60,
	refresh: 7 * 24 * 60 * 60,
} as const;

function getSecret(type: TokenType): string {
	const secret =
		type === 'access' ? process.env.JWT_ACCESS_SECRET : process.env.JWT_REFRESH_SECRET;
	if (!secret) throw new Error(`Missing env var for ${type} token secret`);
	return secret;
}

export function generateToken(type: TokenType, data: TokenData): TokenResult {
	const payload: Record<string, string | number> = {
		userId: data.id,
		email: data.email,
		role: data.role,
		jti: crypto.randomUUID(),
	};

	let refreshTokenId: string | undefined;

	if (type === 'refresh') {
		refreshTokenId = crypto.randomUUID();
		payload.refreshTokenId = refreshTokenId;
	}

	const expiresIn = EXPIRY_SECONDS[type];
	const token = jwt.sign(payload, getSecret(type), { expiresIn });
	const expiryDate = new Date(Date.now() + expiresIn * 1000);

	const result: TokenResult = { token, expiryDate };
	if (refreshTokenId) result.refreshTokenId = refreshTokenId;
	return result;
}

export function verifyToken(type: TokenType, token: string): JwtPayload {
	return jwt.verify(token, getSecret(type)) as JwtPayload;
}

export function generateTokenPair(data: TokenData) {
	const { token: accessToken } = generateToken('access', data);
	const refreshToken = generateToken('refresh', data);
	return { accessToken, refreshToken };
}
