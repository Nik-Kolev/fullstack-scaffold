import { Router } from 'express';
import { getUser } from '../controllers/userController.js';

const router = Router();

router.get('/', getUser);

export default router;
