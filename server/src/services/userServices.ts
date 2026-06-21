import prisma from '../lib/prisma.js';

export const getUser = async (id: number) => {
	return prisma.user.findUnique({ where: { id } });
};

export const updateMe = async (userId: number, data: { name?: string; email?: string }) => {
	return prisma.user.update({ where: { id: userId }, data });
};
