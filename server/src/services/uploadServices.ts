import type { Prisma } from '../generated/prisma/index.js';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { uploadFile, deleteFile as deleteR2File } from '../lib/r2.js';
import CustomError from '../utils/customError.js';

export const uploadFiles = async (userId: number, folder: string, data: Express.Multer.File[]) => {
	const fileData: Prisma.UserFileCreateManyInput[] = await Promise.all(
		data.map(async (file) => {
			const ext = file.originalname.split('.').pop();
			const key = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
			const url = await uploadFile(key, file.buffer, file.mimetype);

			return {
				url,
				key,
				originalName: file.originalname,
				userId,
				size: file.size,
				folder,
				mimeType: file.mimetype,
			};
		}),
	);

	await prisma.userFile.createMany({
		data: fileData,
	});

	return fileData;
};

export const deleteFile = async (userId: number, key: string) => {
	const file = await prisma.userFile.findUnique({ where: { key } });

	if (!file || file.userId !== userId) {
		throw new CustomError(404, 'File not found.');
	}

	await deleteR2File(key);
	await prisma.userFile.delete({ where: { key } });
};

export const getFilesByFolder = async (userId: number, folderName: string) => {
	return prisma.userFile.findMany({ where: { userId, folder: folderName } });
};

export const getUserFolders = async (userId: number) => {
	const rows = await prisma.userFile.findMany({
		where: { userId },
		select: { folder: true },
		distinct: ['folder'],
	});
	return rows.map((r) => r.folder);
};
