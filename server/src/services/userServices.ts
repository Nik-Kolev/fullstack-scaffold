import prisma from '../lib/prisma.js';
import { toSafeUser } from '../utils/safeUser.js';

export const getUser = async (id: number) => {
	const user = await prisma.user.findUnique({ where: { id }, omit: { password: true } });
	return user ? toSafeUser(user) : null;
};

export const updateMe = async (userId: number, data: { name?: string; email?: string }) => {
	const user = await prisma.user.update({ where: { id: userId }, data });
	return toSafeUser(user);
};
