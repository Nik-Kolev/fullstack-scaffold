import type { Request, Response, NextFunction } from 'express';
import CustomError from '../utils/customError.js';

export const getUser = (req: Request, res: Response, next: NextFunction) => {
  throw new CustomError(402, 'asd');
  res.status(200).json({ message: 'getUser stub' });
};
