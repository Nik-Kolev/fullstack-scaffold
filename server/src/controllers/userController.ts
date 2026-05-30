import type { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userServices.js';
import CustomError from '../utils/customError.js';

export const getUser = async (req: Request, res: Response) => {
  const user = await userService.getUser(Number(req.params.id));
  if (!user) {
    throw new CustomError(404, 'User not found.');
  }
  res.status(200).json(user);
};

export const createUser = async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  const user = await userService.createUser({ email, name, password });
  res.status(201).json(user);
};
