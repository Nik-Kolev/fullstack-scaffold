import express from 'express';
import type { Application } from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { generalLimiter } from '../middleware/rateLimiter.js';

const origin: string = process.env.ORIGIN;

const corsOptions: CorsOptions = {
	origin: origin,
	methods: 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
};

export default function expressConfig(app: Application) {
	app.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					// Safari upgrades http://localhost to https://localhost otherwise, breaking local dev.
					'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
				},
			},
		}),
	);
	app.use(generalLimiter);
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(cors(corsOptions));
	app.use(cookieParser());
}
