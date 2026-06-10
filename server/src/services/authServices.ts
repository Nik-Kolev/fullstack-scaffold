import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/index.js';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';
import bcrypt from 'bcrypt';
import OAuth2Client from '../lib/googleOAuth.js';
import { google } from 'googleapis';
import redis from '../lib/redis.js';
import { emailQueue } from '../lib/bullmq.js';

export const createUser = async (data: Prisma.UserCreateInput) => {
	const { password, ...rest } = data;
	const hashedPassword = await bcrypt.hash(password!, 10);

	const user = await prisma.user.create({
		data: { ...rest, password: hashedPassword },
		omit: { password: true },
	});

	const { accessToken, refreshToken } = JWT.generateTokenPair(user);

	await prisma.refreshToken.create({
		data: {
			userId: user.id,
			refreshTokenId: refreshToken.refreshTokenId!,
			expiresAt: refreshToken.expiryDate,
		},
	});

	await emailQueue.add('welcome', { name: user.name, email: user.email });

	return { user, accessToken, refreshToken };
};

export const loginUser = async (email: string, password: string) => {
	const userMatch = await prisma.user.findUnique({ where: { email } });

	if (!userMatch) {
		throw new CustomError(
			401,
			'The email address or password you entered is incorrect. Please try again.',
		);
	}

	if (!userMatch.password) {
		throw new CustomError(
			401,
			'The email address or password you entered is incorrect. Please try again.',
		);
	}

	const isPasswordValid = await bcrypt.compare(password, userMatch.password);

	if (!isPasswordValid) {
		throw new CustomError(
			401,
			'The email address or password you entered is incorrect. Please try again.',
		);
	}

	const { accessToken, refreshToken } = JWT.generateTokenPair(userMatch);

	await prisma.refreshToken.create({
		data: {
			userId: userMatch.id,
			refreshTokenId: refreshToken.refreshTokenId!,
			expiresAt: refreshToken.expiryDate,
		},
	});

	const { password: _, ...user } = userMatch;

	return { user, accessToken, refreshToken };
};

export const logoutUser = async (refreshTokenId: string) => {
	await prisma.refreshToken.delete({ where: { refreshTokenId } });
};

export const refreshToken = async (
	refreshTokenId: string,
	user: { id: number; email: string; role: string },
) => {
	const existing = await prisma.refreshToken.findUnique({ where: { refreshTokenId } });

	if (!existing || existing.expiresAt < new Date()) {
		throw new CustomError(401, 'Invalid or expired refresh token.');
	}

	await prisma.refreshToken.delete({ where: { refreshTokenId } });

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
	const { tokens } = await OAuth2Client.getToken(code);
	OAuth2Client.setCredentials(tokens);

	const { data } = await google.oauth2('v2').userinfo.get({ auth: OAuth2Client });

	const user = await prisma.user.upsert({
		where: { googleId: `${data.id}` },
		update: {},
		create: {
			googleId: data.id as string,
			email: data.email as string,
			name: data.name as string,
		},
		omit: { password: true },
	});

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
	const user = await prisma.user.findUnique({ where: { id: userId } });

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

	await prisma.$transaction([
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

	const { password: _, ...safeUser } = user;
	return { accessToken, refreshToken, user: { ...safeUser, hasPassword: true } };
};
