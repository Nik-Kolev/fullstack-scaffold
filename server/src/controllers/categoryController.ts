import type { Request, Response } from 'express';
import * as categoryService from '../services/categoryService.js';

export const getCategories = async (_req: Request, res: Response) => {
	const categories = await categoryService.getCategories();
	res.status(200).json({ categories });
};
