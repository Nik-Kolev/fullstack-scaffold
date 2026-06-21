import CustomError from '../utils/customError.js';
import type { Request, Response } from 'express';
import * as userService from '../services/userServices.js';

export const getMe = async (req: Request, res: Response) => {
	const user = await userService.getUser(req.user!.userId);
	if (!user) throw new CustomError(404, 'User not found.');
	res.status(200).json({ user });
};

export const updateMe = async (req: Request, res: Response) => {
	const user = await userService.updateMe(req.user!.userId, req.body);
	res.status(200).json({ user });
};

export const getUser = async (req: Request, res: Response) => {
	const user = await userService.getUser(Number(req.params.id));
	if (!user) {
		throw new CustomError(404, 'User not found.');
	}
	res.status(200).json(user);
};
