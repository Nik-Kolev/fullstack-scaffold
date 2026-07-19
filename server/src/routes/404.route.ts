import { Router } from 'express';
import type { Request, Response } from 'express';
import CustomError from '../utils/customError.js';

const router = Router();

router.use((req: Request, _res: Response) => {
	throw new CustomError(404, `Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND');
});

export default router;
