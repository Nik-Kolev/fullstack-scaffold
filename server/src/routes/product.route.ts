import { Router } from 'express';
import * as productController from '../controllers/productController.js';
import validateBody from '../middleware/validateBody.js';
import * as productSchemas from '../schemas/product.schema.js';
import { isAuth } from '../middleware/isAuthenticated.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post(
	'/',
	isAuth,
	requireRole('admin'),
	validateBody(productSchemas.createProductSchema),
	productController.createProduct,
);
router.put(
	'/:id',
	isAuth,
	requireRole('admin'),
	validateBody(productSchemas.updateProductSchema),
	productController.updateProduct,
);
router.delete('/:id', isAuth, requireRole('admin'), productController.deactivateProduct);
router.post(
	'/:id/image',
	isAuth,
	requireRole('admin'),
	uploadImage.single('image'),
	productController.uploadProductImage,
);

export default router;
