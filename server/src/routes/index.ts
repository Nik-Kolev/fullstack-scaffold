import { Router } from 'express';
import userRoutes from './user.routes.js';
import MissingPageRoute404 from './404.route.js';

const router = Router();

router.use('/user', userRoutes);

// Last place to catch all non-existing routes
router.use(MissingPageRoute404);

export default router;
