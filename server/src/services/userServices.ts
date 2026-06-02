import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/index.js';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';

export const createUser = async (data: Prisma.UserCreateInput) => {
  const user = await prisma.user.create({ data, omit: { password: true } });

  const { accessToken, refreshToken } = JWT.generateTokenPair(user);

  await prisma.refreshToken.create({ data: { userId: user.id, refreshTokenId: refreshToken.refreshTokenId!, expiresAt: refreshToken.expiryDate } });

  return { user, accessToken, refreshToken };
};

export const loginUser = async (email: string, password: string) => {
  const userMatch = await prisma.user.findUnique({ where: { email } });

  if (!userMatch || userMatch.password !== password) {
    throw new CustomError(401, 'The email address or password you entered is incorrect. Please try again.');
  }

  const { accessToken, refreshToken } = JWT.generateTokenPair(userMatch);

  await prisma.refreshToken.create({ data: { userId: userMatch.id, refreshTokenId: refreshToken.refreshTokenId!, expiresAt: refreshToken.expiryDate } });

  const { password: _, ...user } = userMatch;

  return { user, accessToken, refreshToken };
};

export const logoutUser = async (refreshTokenId: string) => {
  await prisma.refreshToken.delete({ where: { refreshTokenId } });
};

export const getUser = async (id: number) => {
  return await prisma.user.findUnique({ where: { id }, omit: { password: true } });
};
