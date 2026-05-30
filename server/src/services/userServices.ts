import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/index.js';

export const createUser = async (data: Prisma.UserCreateInput) => {
  return await prisma.user.create({ data, omit: { password: true } });
};

export const getUser = async (id: number) => {
  return await prisma.user.findUnique({ where: { id }, omit: { password: true } });
};
