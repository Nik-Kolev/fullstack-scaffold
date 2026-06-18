import type { Request, Response } from 'express';
import * as paymentService from '../services/paymentService.js';

export const createCheckoutSession = async (req: Request, res: Response) => {
	const { amountTotal, quantity, description } = req.body;

	const { url } = await paymentService.createCheckoutSession(
		req.user!.userId,
		amountTotal,
		quantity,
		description,
	);

	res.status(201).json({ url });
};
