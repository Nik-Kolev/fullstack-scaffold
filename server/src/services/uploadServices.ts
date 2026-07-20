import type { Prisma } from '../generated/prisma/index.js';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { uploadFile, deleteFile as deleteR2File } from '../lib/r2.js';
import { assertMatchesDeclaredType, extensionForMimeType } from '../utils/fileValidation.js';
import CustomError from '../utils/customError.js';

export const uploadFiles = async (userId: number, folder: string, data: Express.Multer.File[]) => {
	data.forEach(assertMatchesDeclaredType);

	const results = await Promise.allSettled(
		data.map(async (file) => {
			const ext = extensionForMimeType(file.mimetype);
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
			} satisfies Prisma.UserFileCreateManyInput;
		}),
	);

	const succeeded = results.filter(
		(r): r is PromiseFulfilledResult<Prisma.UserFileCreateManyInput> =>
			r.status === 'fulfilled',
	);
	const failed = results.find((r) => r.status === 'rejected') as
		| PromiseRejectedResult
		| undefined;

	if (failed) {
		// Roll back whatever already made it to R2 so a partial failure doesn't leave orphaned files.
		await Promise.all(
			succeeded.map((r) =>
				deleteR2File(r.value.key).catch((err) => {
					console.error(`Failed to roll back orphaned upload ${r.value.key}:`, err);
				}),
			),
		);
		throw failed.reason;
	}

	const fileData = succeeded.map((r) => r.value);

	try {
		await prisma.userFile.createMany({
			data: fileData,
		});
	} catch (err) {
		await Promise.all(
			fileData.map((f) =>
				deleteR2File(f.key).catch((e) => {
					console.error(`Failed to roll back orphaned upload ${f.key}:`, e);
				}),
			),
		);
		throw err;
	}

	return fileData;
};

export const deleteFile = async (userId: number, key: string) => {
	const file = await prisma.userFile.findUnique({ where: { key } });

	if (!file || file.userId !== userId) {
		throw new CustomError(404, 'File not found.', 'FILE_NOT_FOUND');
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
