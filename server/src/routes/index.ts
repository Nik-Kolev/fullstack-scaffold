import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import uploadRoutes from './upload.route.js';
import paymentRoutes from './payment.route.js';
import productRoutes from './product.route.js';
import MissingPageRoute404 from './404.route.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/upload', uploadRoutes);
router.use('/payment', paymentRoutes);
router.use('/product', productRoutes);

// Last place to catch all non-existing routes
router.use(MissingPageRoute404);

export default router;
