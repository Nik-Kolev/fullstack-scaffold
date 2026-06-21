import prisma from '../lib/prisma.js';
import CustomError from '../utils/customError.js';

export const createProduct = async (data: {
	name: string;
	description?: string;
	price: number;
	imageUrl?: string;
}) => {
	return prisma.product.create({ data });
};

export const getProducts = async () => {
	return prisma.product.findMany({
		where: { isActive: true },
		orderBy: { createdAt: 'desc' },
	});
};

export const getProductById = async (id: number) => {
	const product = await prisma.product.findUnique({ where: { id } });
	if (!product) throw new CustomError(404, 'Product not found.');
	return product;
};

export const updateProduct = async (
	id: number,
	data: { name?: string; description?: string; price?: number; imageUrl?: string },
) => {
	const product = await prisma.product.findUnique({ where: { id } });
	if (!product) throw new CustomError(404, 'Product not found.');
	return prisma.product.update({ where: { id }, data });
};

export const deactivateProduct = async (id: number) => {
	const product = await prisma.product.findUnique({ where: { id } });
	if (!product) throw new CustomError(404, 'Product not found.');
	return prisma.product.update({ where: { id }, data: { isActive: false } });
};
