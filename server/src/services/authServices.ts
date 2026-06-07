import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/index.js';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';
import bcrypt from 'bcrypt';
import OAuth2Client from '../lib/google.js';
import { google } from 'googleapis';

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
