import { Router } from 'express';
import * as userController from '../controllers/userController.js';

const router = Router();

router.get('/:id', userController.getUser);

export default router;
