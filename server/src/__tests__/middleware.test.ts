import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAuth } from '../middleware/isAuthenticated.js';

import { requireRole } from '../middleware/requireRole.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { errorHandler } from '../middleware/errorHandler.js';
import redis from '../lib/redis.js';

beforeEach(async () => {
	await redis.del('auth:valid-after:1');
});

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
		expect(res.body.code).toBe('INVALID_TOKEN');
	});

	it('returns 401 for an expired token', async () => {
		const res = await request(app)
			.get('/protected')
			.set('Authorization', `Bearer ${expiredToken()}`);
		expect(res.status).toBe(401);
		expect(res.body.code).toBe('TOKEN_EXPIRED');
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
		expect(res.body.code).toBe('TOKEN_REVOKED');
	});

	it('returns 401 for a non-Bearer authorization scheme', async () => {
		const token = makeToken();
		const res = await request(app).get('/protected').set('Authorization', `Basic ${token}`);
		expect(res.status).toBe(401);
		expect(res.body.code).toBe('NO_TOKEN');
	});

	it('returns 401 for a token issued before a password change cut it off', async () => {
		const token = makeToken('user');
		const { userId } = jwt.decode(token) as { userId: number };
		const key = `auth:valid-after:${userId}`;
		await redis.setex(key, 900, Math.floor(Date.now() / 1000) + 60);

		const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

		await redis.del(key);

		expect(res.status).toBe(401);
		expect(res.body.code).toBe('TOKEN_REVOKED');
	});

	it('returns 401 for an empty Bearer token', async () => {
		const res = await request(app).get('/protected').set('Authorization', 'Bearer ');
		expect(res.status).toBe(401);
	});

	it('returns 401 for a token signed with the wrong secret', async () => {
		const badToken = jwt.sign(
			{ userId: 1, email: 'test@example.com', role: 'user', jti: crypto.randomUUID() },
			'wrong-secret',
			{ expiresIn: '15m' },
		);
		const res = await request(app).get('/protected').set('Authorization', `Bearer ${badToken}`);
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

	it('returns 403 when the role claim is absent from the token', async () => {
		const noRoleToken = jwt.sign(
			{ userId: 1, email: 'test@example.com', jti: crypto.randomUUID() },
			process.env.JWT_ACCESS_SECRET!,
			{ expiresIn: '15m' },
		);
		const res = await request(app).get('/admin').set('Authorization', `Bearer ${noRoleToken}`);
		expect(res.status).toBe(403);
		expect(res.body.code).toBe('FORBIDDEN');
	});
});

// ─── authLimiter ─────────────────────────────────────────────────────────────

describe('authLimiter', () => {
	const originalNodeEnv = process.env.NODE_ENV;
	let limiterApp: express.Application;

	beforeEach(async () => {
		process.env.NODE_ENV = 'production'; // authLimiter's skip() only limits in production
		const keys = await redis.keys('rl:auth:*');
		if (keys.length) await redis.del(...keys);
		limiterApp = express();
		limiterApp.use(authLimiter);
		limiterApp.get('/ping', (_req, res) => res.sendStatus(200));
		limiterApp.use(errorHandler);
	});

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
	});

	it('allows requests within the limit', async () => {
		for (let i = 0; i < 10; i++) {
			const res = await request(limiterApp).get('/ping');
			expect(res.status).toBe(200);
		}
	});

	it('returns 429 when the limit is exceeded', async () => {
		for (let i = 0; i < 10; i++) {
			await request(limiterApp).get('/ping');
		}
		const res = await request(limiterApp).get('/ping');
		expect(res.status).toBe(429);
	});
});
