import type { Request, Response } from 'express';
import * as productService from '../services/productService.js';
import type { ProductQuery } from '../schemas/product.schema.js';
import CustomError from '../utils/customError.js';

export const createProduct = async (req: Request, res: Response) => {
	const product = await productService.createProduct(req.body, req.file);
	res.status(201).json({ product });
};

export const getProducts = async (req: Request, res: Response) => {
	const result = await productService.getProducts(req.validatedQuery as ProductQuery);
	res.status(200).json(result);
};

export const getProductById = async (req: Request, res: Response) => {
	const product = await productService.getProductById(Number(req.params.id));
	res.status(200).json({ product });
};

export const updateProduct = async (req: Request, res: Response) => {
	const product = await productService.updateProduct(Number(req.params.id), req.body);
	res.status(200).json({ product });
};

export const deactivateProduct = async (req: Request, res: Response) => {
	await productService.deactivateProduct(Number(req.params.id));
	res.status(204).send();
};

export const deleteProductImage = async (req: Request, res: Response) => {
	await productService.deleteProductImage(Number(req.params.id));
	res.status(204).send();
};

export const uploadProductImage = async (req: Request, res: Response) => {
	if (!req.file) throw new CustomError(400, 'Image file is required.');
	const product = await productService.uploadProductImage(Number(req.params.id), req.file);
	res.status(200).json({ product });
};

export const likeProduct = async (req: Request, res: Response) => {
	const product = await productService.likeProduct(Number(req.params.id), req.user!.userId);
	res.status(200).json({ product });
};

export const unlikeProduct = async (req: Request, res: Response) => {
	const product = await productService.unlikeProduct(Number(req.params.id), req.user!.userId);
	res.status(200).json({ product });
};
