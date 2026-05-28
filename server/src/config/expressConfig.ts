import express from 'express';
import type { Application } from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';

const PORT: number = Number(process.env.PORT);
const origin: string = process.env.ORIGIN;

const corsOptions: CorsOptions = {
  origin: origin,
  methods: 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

export default function expressConfig(app: Application) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors(corsOptions));
  app.use(cookieParser());
  app.listen(PORT, () => console.log(`Server is on and listening on port ${PORT}`));
}
