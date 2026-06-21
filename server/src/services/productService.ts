import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { uploadFile, deleteFile as deleteR2File } from '../lib/r2.js';
import CustomError from '../utils/customError.js';

export const createProduct = async (
	data: { name: string; description?: string; price: number; imageUrl?: string },
	file?: Express.Multer.File,
) => {
	const product = await prisma.product.create({ data });

	if (!file) return product;

	try {
		const ext = file.originalname.split('.').pop();
		const key = `products/${product.id}/${crypto.randomUUID()}.${ext}`;
		const imageUrl = await uploadFile(key, file.buffer, file.mimetype);
		return prisma.product.update({ where: { id: product.id }, data: { imageUrl } });
	} catch {
		await prisma.product.delete({ where: { id: product.id } });
		throw new CustomError(500, 'Image upload failed. Product was not created.');
	}
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

	if (product.imageUrl) {
		const key = product.imageUrl.replace(`${process.env.R2_PUBLIC_URL!}/`, '');
		await deleteR2File(key);
	}

	return prisma.product.update({ where: { id }, data: { isActive: false, imageUrl: null } });
};

export const deleteProductImage = async (id: number) => {
	const product = await prisma.product.findUnique({ where: { id } });
	if (!product) throw new CustomError(404, 'Product not found.');
	if (!product.imageUrl) throw new CustomError(404, 'Product has no image.');

	const key = product.imageUrl.replace(`${process.env.R2_PUBLIC_URL!}/`, '');
	await deleteR2File(key);

	return prisma.product.update({ where: { id }, data: { imageUrl: null } });
};

export const uploadProductImage = async (id: number, file: Express.Multer.File) => {
	const product = await prisma.product.findUnique({ where: { id } });
	if (!product) throw new CustomError(404, 'Product not found.');

	if (product.imageUrl) {
		const oldKey = product.imageUrl.replace(`${process.env.R2_PUBLIC_URL!}/`, '');
		await deleteR2File(oldKey);
	}

	const ext = file.originalname.split('.').pop();
	const key = `products/${id}/${crypto.randomUUID()}.${ext}`;
	const imageUrl = await uploadFile(key, file.buffer, file.mimetype);

	return prisma.product.update({ where: { id }, data: { imageUrl } });
};
