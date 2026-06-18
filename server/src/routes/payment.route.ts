import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import validateBody from '../middleware/validateBody.js';
import * as paymentSchemas from '../schemas/payment.schema.js';
import { checkoutLimiter } from '../middleware/rateLimiter.js';
import { isAuth } from '../middleware/isAuthenticated.js';

const router = Router();

router.post(
	'/checkout',
	isAuth,
	checkoutLimiter,
	validateBody(paymentSchemas.createCheckoutSessionSchema),
	paymentController.createCheckoutSession,
);

export default router;
