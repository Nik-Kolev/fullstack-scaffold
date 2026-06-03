import prisma from '../lib/prisma.js';

export const getUser = async (id: number) => {
	return await prisma.user.findUnique({ where: { id }, omit: { password: true } });
};
