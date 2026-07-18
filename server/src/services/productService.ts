import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { uploadFile, deleteFile as deleteR2File } from '../lib/r2.js';
import CustomError from '../utils/customError.js';
import { titleCase } from '../schemas/product.schema.js';
import type { Prisma } from '../generated/prisma/index.js';

type SortField = 'createdAt' | 'price' | 'likesCount';

function encodeCursor(
	sortField: SortField,
	order: 'asc' | 'desc',
	sortValue: Date | number,
	id: number,
): string {
	const serializable = sortValue instanceof Date ? sortValue.toISOString() : sortValue;
	return Buffer.from(JSON.stringify({ sortField, order, sortValue: serializable, id })).toString(
		'base64url',
	);
}

// A cursor from a different sortField/order would otherwise be silently misinterpreted
// rather than rejected — comparing the embedded values here turns that into a 400.
function decodeCursor(
	cursor: string,
	sortField: SortField,
	order: 'asc' | 'desc',
): { sortValue: Date | number; id: number } {
	try {
		const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
		if (parsed.sortField !== sortField || parsed.order !== order) throw new Error();

		const sortValue =
			sortField === 'createdAt' ? new Date(parsed.sortValue) : Number(parsed.sortValue);
		if (sortField === 'createdAt' && isNaN((sortValue as Date).getTime())) throw new Error();
		if (sortField !== 'createdAt' && isNaN(sortValue as number)) throw new Error();

		const id = Number(parsed.id);
		if (isNaN(id)) throw new Error();

		return { sortValue, id };
	} catch {
		throw new CustomError(400, 'Invalid cursor.');
	}
}

type ProductInput = {
	name: string;
	description?: string;
	price: number;
	imageUrl?: string;
	categoryId: number;
	quantity?: number;
	discountPercent?: number;
	color: string;
	shape: string;
};

export const createProduct = async (data: ProductInput, file?: Express.Multer.File) => {
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

type GetProductsParams = {
	cursor?: string | undefined;
	limit: number;
	categoryId?: number | undefined;
	minPrice?: number | undefined;
	maxPrice?: number | undefined;
	color?: string | undefined;
	shape?: string | undefined;
	sortBy?: 'price' | 'likesCount' | undefined;
	order: 'asc' | 'desc';
};

export const getProducts = async (params: GetProductsParams) => {
	const { cursor, limit, categoryId, minPrice, maxPrice, color, shape, sortBy, order } = params;
	const sortField: SortField = sortBy ?? 'createdAt';

	const where: Prisma.ProductWhereInput = {
		isActive: true,
		...(categoryId !== undefined && { categoryId }),
		...(color !== undefined && { color: titleCase(color) }),
		...(shape !== undefined && { shape: titleCase(shape) }),
		...((minPrice !== undefined || maxPrice !== undefined) && {
			price: {
				...(minPrice !== undefined && { gte: minPrice }),
				...(maxPrice !== undefined && { lte: maxPrice }),
			},
		}),
	};

	if (cursor) {
		const { sortValue, id } = decodeCursor(cursor, sortField, order);
		const cmp = order === 'asc' ? 'gt' : 'lt';
		where.OR = [
			{ [sortField]: { [cmp]: sortValue } },
			{ [sortField]: sortValue, id: { [cmp]: id } },
		];
	}

	const products = await prisma.product.findMany({
		where,
		orderBy: [{ [sortField]: order }, { id: order }],
		take: limit + 1,
	});

	let nextCursor: string | null = null;
	if (products.length > limit) {
		products.pop();
		const last = products[products.length - 1]!;
		nextCursor = encodeCursor(sortField, order, last[sortField], last.id);
	}

	return { products, nextCursor, limit };
};

export const getProductById = async (id: number) => {
	const product = await prisma.product.findUnique({ where: { id } });
	if (!product) throw new CustomError(404, 'Product not found.');
	return product;
};

export const updateProduct = async (id: number, data: Partial<ProductInput>) => {
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

export const likeProduct = async (productId: number, userId: number) => {
	const product = await prisma.product.findUnique({ where: { id: productId } });
	if (!product || !product.isActive) throw new CustomError(404, 'Product not found.');

	return prisma.$transaction(async (tx) => {
		await tx.like.create({ data: { productId, userId } });
		return tx.product.update({
			where: { id: productId },
			data: { likesCount: { increment: 1 } },
		});
	});
};

export const unlikeProduct = async (productId: number, userId: number) => {
	const like = await prisma.like.findUnique({
		where: { productId_userId: { productId, userId } },
	});
	if (!like) throw new CustomError(404, 'Like not found.');

	return prisma.$transaction(async (tx) => {
		await tx.like.delete({ where: { id: like.id } });
		return tx.product.update({
			where: { id: productId },
			data: { likesCount: { decrement: 1 } },
		});
	});
};
