import { Router } from 'express';
import * as uploadController from '../controllers/uploadController.js';
import validateBody from '../middleware/validateBody.js';
import * as uploadSchemas from '../schemas/upload.schema.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { isAuth } from '../middleware/isAuthenticated.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post(
	'/',
	uploadLimiter,
	isAuth,
	upload.array('files', 10),
	validateBody(uploadSchemas.folderNameSchema),
	uploadController.uploadFiles,
);
router.delete('/:key', isAuth, uploadController.deleteFile);
router.get('/folder/:name', isAuth, uploadController.getFilesByFolder);
router.get('/folders', isAuth, uploadController.getUserFolders);

export default router;
