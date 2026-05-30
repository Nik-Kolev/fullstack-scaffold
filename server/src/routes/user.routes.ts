import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import validateBody from '../middleware/validateBody.js';
import * as userSchemas from '../schemas/user.schema.js';

const router = Router();

router.get('/:id', userController.getUser);
router.post('/', validateBody(userSchemas.registerSchema), userController.createUser);

export default router;
