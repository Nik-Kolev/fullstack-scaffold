import multer from 'multer';
import CustomError from '../utils/customError.js';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_SIZE_BYTES },
	fileFilter(_req, file, cb) {
		if ([...IMAGE_TYPES, 'application/pdf'].includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new CustomError(400, 'File type not allowed.'));
		}
	},
});

export const uploadImage = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_SIZE_BYTES },
	fileFilter(_req, file, cb) {
		if (IMAGE_TYPES.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new CustomError(400, 'Only image files are allowed (jpeg, png, webp).'));
		}
	},
});
