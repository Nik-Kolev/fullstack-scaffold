import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

router.use((req: Request, res: Response) => {
	res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

export default router;
