import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import validateBody from '../middleware/validateBody.js';
import * as authSchemas from '../schemas/auth.schema.js';

const router = Router();

router.post('/register', validateBody(authSchemas.registerSchema), authController.createUser);
router.post('/login', validateBody(authSchemas.loginSchema), authController.loginUser);
router.post('/logout', authController.logoutUser);
router.post('/refresh', authController.refreshToken);

export default router;
