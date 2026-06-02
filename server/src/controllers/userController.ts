import type { Request, Response } from 'express';
import * as userService from '../services/userServices.js';
import CustomError from '../utils/customError.js';
import * as JWT from '../lib/jwt.js';

export const createUser = async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  const { user, accessToken, refreshToken } = await userService.createUser({ email, name, password });

  res.cookie('refreshToken', refreshToken.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: refreshToken.expiryDate.getTime() - Date.now(),
  });
  res.status(201).json({ user, accessToken });
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await userService.loginUser(email, password);

  res.cookie('refreshToken', refreshToken.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: refreshToken.expiryDate.getTime() - Date.now(),
  });
  res.status(200).json({ user, accessToken });
};

export const logoutUser = async (req: Request, res: Response) => {
  const cookie = req.cookies.refreshToken;
  const token = JWT.verifyToken('refresh', cookie);
  await userService.logoutUser(token.refreshTokenId!);

  res.clearCookie('refreshToken');
  res.sendStatus(204);
};

export const getUser = async (req: Request, res: Response) => {
  const user = await userService.getUser(Number(req.params.id));
  if (!user) {
    throw new CustomError(404, 'User not found.');
  }
  res.status(200).json(user);
};
