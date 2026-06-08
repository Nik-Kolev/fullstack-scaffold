import request from 'supertest';
import express from 'express';
import app from '../app.js';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { isAuth } from '../middleware/isAuthenticated.js';
import errorHandler from '../middleware/errorHandler.js';

vi.mock('../lib/bullmq.js', () => ({
	emailQueue: { add: vi.fn() },
}));

const TEST_USER = { email: 'test@example.com', password: 'Test1234', name: 'Tester' };

// Mini app used to test that blacklisted tokens are rejected by isAuth
const protectedApp = express();
protectedApp.get('/protected', isAuth, (_req, res) => res.sendStatus(200));
protectedApp.use(errorHandler);

function getCookies(res: request.Response): string[] {
	const val = res.headers['set-cookie'];
	if (!val) return [];
	return Array.isArray(val) ? val : [val];
}

async function register() {
	return request(app).post('/api/auth/register').send(TEST_USER);
}

async function login() {
	return request(app)
		.post('/api/auth/login')
		.send({ email: TEST_USER.email, password: TEST_USER.password });
}

beforeEach(async () => {
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
	await redis.flushdb();
});

afterAll(async () => {
	await prisma.$disconnect();
	await redis.quit();
});

// ─── Register ────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
	it('returns 201 with accessToken and user (no password)', async () => {
		const res = await register();

		expect(res.status).toBe(201);
		expect(res.body).toHaveProperty('accessToken');
		expect(res.body.user).toMatchObject({ email: TEST_USER.email, role: 'user' });
		expect(res.body.user).not.toHaveProperty('password');
	});

	it('sets an httpOnly refreshToken cookie', async () => {
		const res = await register();
		const cookies = getCookies(res);

		expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
		expect(cookies.some((c) => c.toLowerCase().includes('httponly'))).toBe(true);
	});

	it('returns 409 on duplicate email', async () => {
		await register();
		const res = await register();

		expect(res.status).toBe(409);
	});

	it('returns 400 for invalid email format', async () => {
		const res = await request(app)
			.post('/api/auth/register')
			.send({ email: 'not-an-email', password: 'Test1234' });

		expect(res.status).toBe(400);
	});

	it('returns 400 for weak password', async () => {
		const res = await request(app)
			.post('/api/auth/register')
			.send({ email: TEST_USER.email, password: 'short' });

		expect(res.status).toBe(400);
	});

	it('returns 400 when password is missing', async () => {
		const res = await request(app).post('/api/auth/register').send({ email: TEST_USER.email });

		expect(res.status).toBe(400);
	});
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
	it('returns 200 with accessToken and user (no password)', async () => {
		await register();
		const res = await login();

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken');
		expect(res.body.user).toMatchObject({ email: TEST_USER.email });
		expect(res.body.user).not.toHaveProperty('password');
	});

	it('sets a refreshToken cookie', async () => {
		await register();
		const res = await login();
		const cookies = getCookies(res);

		expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
	});

	it('returns 401 for wrong password', async () => {
		await register();
		const res = await request(app)
			.post('/api/auth/login')
			.send({ email: TEST_USER.email, password: 'WrongPass1' });

		expect(res.status).toBe(401);
	});

	it('returns 401 for unknown email', async () => {
		const res = await request(app)
			.post('/api/auth/login')
			.send({ email: 'nobody@example.com', password: 'Test1234' });

		expect(res.status).toBe(401);
	});

	it('returns 400 when fields are missing', async () => {
		const res = await request(app).post('/api/auth/login').send({});

		expect(res.status).toBe(400);
	});
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
	it('returns 200 with new accessToken and rotates cookie', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');

		const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken');
		expect(res.headers['set-cookie']).toBeDefined();
	});

	it('returns 401 with no cookie', async () => {
		const res = await request(app).post('/api/auth/refresh');

		expect(res.status).toBe(401);
	});

	it('returns 401 with an invalid cookie value', async () => {
		const res = await request(app)
			.post('/api/auth/refresh')
			.set('Cookie', 'refreshToken=garbage');

		expect(res.status).toBe(401);
	});

	it('returns 401 on refresh token reuse (rotation enforced)', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');

		await request(app).post('/api/auth/refresh').set('Cookie', cookie);
		const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

		expect(res.status).toBe(401);
	});

	it('does not return the same accessToken after refresh', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');
		const firstToken = loginRes.body.accessToken;

		const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

		expect(refreshRes.status).toBe(200);
		expect(refreshRes.body.accessToken).not.toBe(firstToken);
	});
});

// ─── Logout ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
	it('returns 204 and clears the cookie', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');

		const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);

		expect(res.status).toBe(204);
	});

	it('response sets refreshToken cookie to empty on logout', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');

		const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
		const cookies = getCookies(res);

		expect(cookies.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
	});

	it('returns 401 on refresh after logout', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');

		await request(app).post('/api/auth/logout').set('Cookie', cookie);

		const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

		expect(res.status).toBe(401);
	});

	it('blacklists the access token in Redis on logout', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');
		const { accessToken } = loginRes.body;

		await request(app)
			.post('/api/auth/logout')
			.set('Cookie', cookie)
			.set('Authorization', `Bearer ${accessToken}`);

		const keys = await redis.keys('blacklist:*');
		expect(keys.length).toBe(1);
	});

	it('returns 401 on protected route when access token is blacklisted', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');
		const { accessToken } = loginRes.body;

		await request(app)
			.post('/api/auth/logout')
			.set('Cookie', cookie)
			.set('Authorization', `Bearer ${accessToken}`);

		const res = await request(protectedApp)
			.get('/protected')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(401);
	});

	it('does not blacklist anything when no access token is sent on logout', async () => {
		await register();
		const loginRes = await login();
		const cookie = getCookies(loginRes).join('; ');

		await request(app).post('/api/auth/logout').set('Cookie', cookie);

		const keys = await redis.keys('blacklist:*');
		expect(keys.length).toBe(0);
	});
});
