import prisma from '../lib/prisma.js';

export const getCategories = async () => {
	return prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
};
