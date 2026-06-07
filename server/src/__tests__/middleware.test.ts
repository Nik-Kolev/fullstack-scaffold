import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isAuth } from '../middleware/isAuthenticated.js';
import { requireRole } from '../middleware/requireRole.js';
import errorHandler from '../middleware/errorHandler.js';
import CustomError from '../utils/customError.js';
import redis from '../lib/redis.js';

afterAll(async () => {
	await redis.quit();
});

// ─── Shared test app ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.get('/protected', isAuth, (_req, res) => res.json({ user: _req.user }));
app.get('/admin', isAuth, requireRole('admin'), (_req, res) => res.json({ ok: true }));
app.get('/admin-only', requireRole('admin'), (_req, res) => res.json({ ok: true }));
app.use(errorHandler);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(role: string = 'user', jti: string = crypto.randomUUID()) {
	return jwt.sign(
		{ userId: 1, email: 'test@example.com', role, jti },
		process.env.JWT_ACCESS_SECRET!,
		{ expiresIn: '15m' },
	);
}

function expiredToken() {
	return jwt.sign(
		{
			userId: 1,
			email: 'test@example.com',
			role: 'user',
			exp: Math.floor(Date.now() / 1000) - 60,
		},
		process.env.JWT_ACCESS_SECRET!,
	);
}

// ─── isAuthenticated ─────────────────────────────────────────────────────────

describe('isAuthenticated middleware', () => {
	it('returns 401 when Authorization header is missing', async () => {
		const res = await request(app).get('/protected');
		expect(res.status).toBe(401);
	});

	it('returns 401 for a malformed token', async () => {
		const res = await request(app).get('/protected').set('Authorization', 'Bearer garbage');
		expect(res.status).toBe(401);
	});

	it('returns 401 for an expired token', async () => {
		const res = await request(app)
			.get('/protected')
			.set('Authorization', `Bearer ${expiredToken()}`);
		expect(res.status).toBe(401);
	});

	it('passes through and populates req.user for a valid token', async () => {
		const res = await request(app)
			.get('/protected')
			.set('Authorization', `Bearer ${makeToken('user')}`);

		expect(res.status).toBe(200);
		expect(res.body.user).toMatchObject({ userId: 1, email: 'test@example.com', role: 'user' });
	});

	it('returns 401 for a blacklisted token', async () => {
		const jti = crypto.randomUUID();
		const token = makeToken('user', jti);
		await redis.setex(`blacklist:${jti}`, 900, '1');

		const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(401);
	});
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole middleware', () => {
	it('allows access when the role matches', async () => {
		const res = await request(app)
			.get('/admin')
			.set('Authorization', `Bearer ${makeToken('admin')}`);
		expect(res.status).toBe(200);
	});

	it('returns 403 when role does not match', async () => {
		const res = await request(app)
			.get('/admin')
			.set('Authorization', `Bearer ${makeToken('user')}`);
		expect(res.status).toBe(403);
	});

	it('returns 403 when called without isAuth (no req.user)', async () => {
		const res = await request(app).get('/admin-only');
		expect(res.status).toBe(403);
	});
});

// ─── authLimiter ─────────────────────────────────────────────────────────────

describe('authLimiter', () => {
	let limiterApp: express.Application;

	beforeEach(() => {
		const handler = (_req: Request, _res: Response, next: NextFunction) =>
			next(new CustomError(429, 'Too many requests.'));
		const limiter = rateLimit({ windowMs: 60_000, limit: 3, handler });
		limiterApp = express();
		limiterApp.use(limiter);
		limiterApp.get('/ping', (_req, res) => res.sendStatus(200));
		limiterApp.use(errorHandler);
	});

	it('allows requests within the limit', async () => {
		for (let i = 0; i < 3; i++) {
			const res = await request(limiterApp).get('/ping');
			expect(res.status).toBe(200);
		}
	});

	it('returns 429 when the limit is exceeded', async () => {
		for (let i = 0; i < 3; i++) {
			await request(limiterApp).get('/ping');
		}
		const res = await request(limiterApp).get('/ping');
		expect(res.status).toBe(429);
	});
});
