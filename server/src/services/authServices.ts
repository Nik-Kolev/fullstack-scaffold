import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/index.js';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';
import { toSafeUser, type SafeUser } from '../utils/safeUser.js';
import bcrypt from 'bcrypt';
import OAuth2Client, { createOAuthClient } from '../lib/googleOAuth.js';
import { google } from 'googleapis';
import redis from '../lib/redis.js';
import { emailQueue } from '../lib/bullmq.js';
import crypto from 'crypto';
import { passwordRegex } from '../schemas/auth.schema.js';

const INVALID_CREDENTIALS_MESSAGE =
	'The email address or password you entered is incorrect. Please try again.';

export const createUser = async (data: Prisma.UserCreateInput & { password: string }) => {
	const { password, ...rest } = data;
	const hashedPassword = await bcrypt.hash(password, 10);

	const { user, accessToken, refreshToken } = await prisma.$transaction(async (tx) => {
		const user = await tx.user.create({
			data: { ...rest, password: hashedPassword },
		});

		const { accessToken, refreshToken } = JWT.generateTokenPair(user);

		await tx.refreshToken.create({
			data: {
				userId: user.id,
				refreshTokenId: refreshToken.refreshTokenId!,
				expiresAt: refreshToken.expiryDate,
			},
		});

		return { user, accessToken, refreshToken };
	});

	try {
		await emailQueue.add('welcome', { name: user.name, email: user.email });
	} catch (_) {
		// Redis failure — registration already succeeded, email is non-critical
	}

	return { user: toSafeUser(user), accessToken, refreshToken };
};

export const loginUser = async (email: string, password: string) => {
	if (!passwordRegex.test(password)) {
		throw new CustomError(401, INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS'); // shape alone proves it can't be a real password
	}

	const userMatch = await prisma.user.findUnique({ where: { email }, omit: { password: false } });

	if (!userMatch) {
		throw new CustomError(401, INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');
	}

	if (!userMatch.password) {
		throw new CustomError(401, INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');
	}

	const isPasswordValid = await bcrypt.compare(password, userMatch.password);

	if (!isPasswordValid) {
		throw new CustomError(401, INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');
	}

	const { accessToken, refreshToken } = JWT.generateTokenPair(userMatch);

	await prisma.refreshToken.create({
		data: {
			userId: userMatch.id,
			refreshTokenId: refreshToken.refreshTokenId!,
			expiresAt: refreshToken.expiryDate,
		},
	});

	return { user: toSafeUser(userMatch), accessToken, refreshToken };
};

export const logoutUser = async (refreshTokenId: string) => {
	await prisma.refreshToken.deleteMany({ where: { refreshTokenId } });
};

export const refreshToken = async (refreshTokenId: string, userId: number) => {
	const deleted = await prisma.refreshToken.deleteMany({
		where: { refreshTokenId, expiresAt: { gt: new Date() } },
	});

	if (deleted.count === 0) {
		throw new CustomError(401, 'Invalid or expired refresh token.');
	}

	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new CustomError(401, 'Session is invalid, please log in again.');
	}

	const { accessToken, refreshToken } = JWT.generateTokenPair(user);

	await prisma.refreshToken.create({
		data: {
			userId: user.id,
			refreshTokenId: refreshToken.refreshTokenId!,
			expiresAt: refreshToken.expiryDate,
		},
	});

	return { accessToken, refreshToken };
};

export const getGoogleAuthUrl = () => {
	return OAuth2Client.generateAuthUrl({ scope: ['email', 'profile'] });
};

export const handleGoogleCallback = async (code: string) => {
	const client = createOAuthClient();
	const { tokens } = await client.getToken(code);
	client.setCredentials(tokens);

	const { data } = await google.oauth2('v2').userinfo.get({ auth: client });

	if (!data.verified_email) {
		throw new CustomError(
			403,
			'Google account email is not verified.',
			'GOOGLE_EMAIL_UNVERIFIED',
		);
	}

	const user = await prisma.user.upsert({
		where: { email: data.email as string },
		update: { googleId: data.id as string },
		create: {
			googleId: data.id as string,
			email: data.email as string,
			name: data.name ?? data.email?.split('@')[0] ?? 'User',
		},
	});

	const { accessToken, refreshToken } = JWT.generateTokenPair(user);

	await prisma.refreshToken.create({
		data: {
			userId: user.id,
			refreshTokenId: refreshToken.refreshTokenId!,
			expiresAt: refreshToken.expiryDate,
		},
	});

	const oauthCode = crypto.randomUUID();
	await redis.setex(
		`oauth:code:${oauthCode}`,
		30,
		JSON.stringify({
			accessToken,
			user: toSafeUser(user),
			refreshToken: {
				token: refreshToken.token,
				expiryDate: refreshToken.expiryDate.toISOString(),
			},
		}),
	);

	return { oauthCode };
};

export const exchangeGoogleCode = async (code: string) => {
	const raw = await redis.getdel(`oauth:code:${code}`);
	if (!raw) throw new CustomError(401, 'Invalid or expired OAuth code.');
	return JSON.parse(raw) as {
		accessToken: string;
		user: SafeUser;
		refreshToken: { token: string; expiryDate: string };
	};
};

export const blacklistToken = async (jti: string, exp: number) => {
	const ttl = exp - Math.floor(Date.now() / 1000);
	if (ttl > 0) await redis.setex(`blacklist:${jti}`, ttl, 'true');
	//instead of true it can be 1 - does not matter, the value here is not needed
};

export const changePassword = async (
	userId: number,
	currentPassword: string | undefined,
	newPassword: string,
) => {
	const user = await prisma.user.findUnique({ where: { id: userId }, omit: { password: false } });

	if (!user) {
		throw new CustomError(401, 'Session is invalid, please log in again.');
		// edge case, if user is deleted in the future and accessToken is still active
	}

	if (user.password) {
		if (!currentPassword) {
			throw new CustomError(400, 'Current password is required.');
		}
		const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
		if (!isPasswordValid) {
			throw new CustomError(401, 'Current password is incorrect.');
		}
	}

	const newHashedPassword = await bcrypt.hash(newPassword, 10);
	const { accessToken, refreshToken } = JWT.generateTokenPair(user);

	const [, updatedUser] = await prisma.$transaction([
		prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
		prisma.user.update({ where: { id: user.id }, data: { password: newHashedPassword } }),
		prisma.refreshToken.create({
			data: {
				userId: user.id,
				refreshTokenId: refreshToken.refreshTokenId!,
				expiresAt: refreshToken.expiryDate,
			},
		}),
	]);

	try {
		await emailQueue.add('password-changed', { name: user.name, email: user.email });
	} catch (_) {
		// Redis failure — password already changed, email is non-critical
	}

	return { accessToken, refreshToken, user: toSafeUser(updatedUser) };
};

export const forgotPassword = async (email: string) => {
	const user = await prisma.user.findUnique({ where: { email } });

	if (!user) return;

	const rawToken = crypto.randomBytes(32).toString('hex');
	const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
	const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

	await prisma.$transaction([
		prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
		prisma.passwordResetToken.create({
			data: {
				passwordResetToken: tokenHash,
				userId: user.id,
				expiresAt,
			},
		}),
	]);

	try {
		await emailQueue.add('password-reset', {
			name: user.name,
			email: user.email,
			token: rawToken,
		});
	} catch (_) {
		// Redis failure — token already persisted, email is non-critical
	}
};

export const resetPassword = async (token: string, newPassword: string) => {
	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

	const user = await prisma.passwordResetToken.findUnique({
		where: { passwordResetToken: tokenHash },
		include: { user: true },
	});

	if (!user || user.expiresAt < new Date()) {
		throw new CustomError(401, 'Invalid or expired reset token.', 'INVALID_RESET_TOKEN');
	}

	const newHashedPassword = await bcrypt.hash(newPassword, 10);

	const { accessToken, refreshToken } = JWT.generateTokenPair(user.user);

	const [, , updatedUser] = await prisma.$transaction([
		prisma.refreshToken.deleteMany({ where: { userId: user.user.id } }),
		prisma.passwordResetToken.deleteMany({ where: { passwordResetToken: tokenHash } }),
		prisma.user.update({ where: { id: user.user.id }, data: { password: newHashedPassword } }),
		prisma.refreshToken.create({
			data: {
				userId: user.user.id,
				refreshTokenId: refreshToken.refreshTokenId!,
				expiresAt: refreshToken.expiryDate,
			},
		}),
	]);

	try {
		await emailQueue.add('password-changed', { name: user.user.name, email: user.user.email });
	} catch (_) {
		// Redis failure — password already reset, email is non-critical
	}

	return { accessToken, refreshToken, user: toSafeUser(updatedUser) };
};
