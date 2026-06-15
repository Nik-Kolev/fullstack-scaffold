import crypto from 'crypto';
import { uploadFile } from '../lib/R2.js';

export async function uploadFileService(
	file: Express.Multer.File,
): Promise<{ url: string; key: string; originalName: string }> {
	const ext = file.originalname.split('.').pop();
	const key = `uploads/${crypto.randomUUID()}.${ext}`;
	const url = await uploadFile(key, file.buffer, file.mimetype);

	return { url, key, originalName: file.originalname };
}
