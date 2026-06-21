import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validateBody } from '../middleware/validateRequest.js';
import * as authSchemas from '../schemas/auth.schema.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { isAuth } from '../middleware/isAuthenticated.js';

const router = Router();

router.post(
	'/register',
	authLimiter,
	validateBody(authSchemas.registerSchema),
	authController.createUser,
);
router.post('/login', authLimiter, validateBody(authSchemas.loginSchema), authController.loginUser);
router.post('/logout', authController.logoutUser);
router.post('/refresh', authController.refreshToken);
router.get('/google', authController.googleRedirect);
router.get('/google/callback', authController.googleCallback);
router.post(
	'/change-password',
	isAuth,
	validateBody(authSchemas.changePasswordSchema),
	authController.changePassword,
);
router.post(
	'/forgot-password',
	authLimiter,
	validateBody(authSchemas.emailSchema),
	authController.forgotPassword,
);
router.post(
	'/reset-password',
	authLimiter,
	validateBody(authSchemas.resetPasswordSchema),
	authController.resetPassword,
);

export default router;
