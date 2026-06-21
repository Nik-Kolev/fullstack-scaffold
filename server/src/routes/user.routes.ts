import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { validateBody } from '../middleware/validateRequest.js';
import * as userSchemas from '../schemas/user.schema.js';
import { isAuth } from '../middleware/isAuthenticated.js';

const router = Router();

router.get('/me', isAuth, userController.getMe);
router.patch('/me', isAuth, validateBody(userSchemas.updateMeSchema), userController.updateMe);
router.get('/:id', userController.getUser);

export default router;
