import type { Request, Response } from 'express';
import * as uploadService from '../services/uploadServices.js';
import CustomError from '../utils/customError.js';

export const uploadFiles = async (req: Request, res: Response) => {
	const files = req.files as Express.Multer.File[] | undefined;
	const folderName = req.body.folderName;

	if (!files || files.length === 0) {
		throw new CustomError(400, 'No files provided.');
	}

	const fileData = await uploadService.uploadFiles(req.user!.userId, folderName, files);

	res.status(200).json({ fileData });
};

export const deleteFile = async (req: Request, res: Response) => {
	const key = req.params.key as string;
	await uploadService.deleteFile(req.user!.userId, key);

	res.sendStatus(204);
};
