import multer from 'multer';
import CustomError from '../utils/customError.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_SIZE_BYTES },
	fileFilter(_req, file, cb) {
		if (ALLOWED_TYPES.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new CustomError(400, 'File type not allowed.'));
		}
	},
});
