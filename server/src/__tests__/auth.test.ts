import request from 'supertest';
import express from 'express';
import app from '../app.js';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { isAuth } from '../middleware/isAuthenticated.js';
import errorHandler from '../middleware/errorHandler.js';
import * as JWT from '../lib/jwt.js';
import crypto from 'crypto';
import { emailQueue } from '../lib/bullmq.js';

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
	vi.clearAllMocks();
	await prisma.payment.deleteMany();
	await prisma.passwordResetToken.deleteMany();
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

	it('persists a RefreshToken row in the DB', async () => {
		await register();
		const count = await prisma.refreshToken.count();
		expect(count).toBe(1);
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

	it('issues a different cookie value after rotation', async () => {
		await register();
		const loginRes = await login();
		const oldCookie = getCookies(loginRes).find((c) => c.startsWith('refreshToken='))!;
		const cookie = getCookies(loginRes).join('; ');

		const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
		const newCookie = getCookies(refreshRes).find((c) => c.startsWith('refreshToken='))!;

		expect(newCookie.split(';')[0]).not.toBe(oldCookie.split(';')[0]);
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

	it('returns 204 with no refresh cookie (graceful)', async () => {
		const res = await request(app).post('/api/auth/logout');
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

// ─── Change Password ──────────────────────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
	async function changePasswordReq(accessToken: string, body: object) {
		return request(app)
			.post('/api/auth/change-password')
			.set('Authorization', `Bearer ${accessToken}`)
			.send(body);
	}

	it('returns 200 with user, accessToken, and message', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		const res = await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: 'NewPass5678',
		});

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken');
		expect(res.body).toHaveProperty('message');
		expect(res.body.user).toMatchObject({ email: TEST_USER.email, hasPassword: true });
		expect(res.body.user).not.toHaveProperty('password');
	});

	it('sets a new refreshToken cookie', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		const res = await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: 'NewPass5678',
		});

		const cookies = getCookies(res);
		expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
		expect(cookies.some((c) => c.toLowerCase().includes('httponly'))).toBe(true);
	});

	it('new refresh cookie can be used to refresh', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		const changeRes = await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: 'NewPass5678',
		});

		const newCookie = getCookies(changeRes).join('; ');
		const res = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken');
	});

	it('invalidates old refresh token after password change', async () => {
		await register();
		const loginRes = await login();
		const oldCookie = getCookies(loginRes).join('; ');
		const { accessToken } = loginRes.body;

		await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: 'NewPass5678',
		});

		const res = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
		expect(res.status).toBe(401);
	});

	it('blacklists old access token after password change', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: 'NewPass5678',
		});

		const res = await request(protectedApp)
			.get('/protected')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(401);
	});

	it('stores blacklisted access token with positive TTL', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();
		const payload = JWT.verifyToken('access', accessToken);

		await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: 'NewPass5678',
		});

		const ttl = await redis.ttl(`blacklist:${payload.jti}`);
		expect(ttl).toBeGreaterThan(0);
	});

	it('allows password set without currentPassword when user has no password', async () => {
		const googleUser = await prisma.user.create({
			data: { email: 'google@example.com', name: 'Google User', googleId: 'google-uid-123' },
		});
		const { accessToken } = JWT.generateTokenPair(googleUser);

		const res = await changePasswordReq(accessToken, { newPassword: 'NewPass5678' });

		expect(res.status).toBe(200);
		expect(res.body.user.hasPassword).toBe(true);
	});

	it('returns 401 for wrong currentPassword', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		const res = await changePasswordReq(accessToken, {
			currentPassword: 'WrongPass1',
			newPassword: 'NewPass5678',
		});

		expect(res.status).toBe(401);
	});

	it('returns 400 when currentPassword is missing but user has one', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		const res = await changePasswordReq(accessToken, { newPassword: 'NewPass5678' });

		expect(res.status).toBe(400);
	});

	it('returns 400 when newPassword is the same as currentPassword', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		const res = await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: TEST_USER.password,
		});

		expect(res.status).toBe(400);
	});

	it('returns 400 for a weak newPassword', async () => {
		await register();
		const {
			body: { accessToken },
		} = await login();

		const res = await changePasswordReq(accessToken, {
			currentPassword: TEST_USER.password,
			newPassword: 'weak',
		});

		expect(res.status).toBe(400);
	});

	it('returns 401 when not authenticated', async () => {
		const res = await request(app)
			.post('/api/auth/change-password')
			.send({ currentPassword: TEST_USER.password, newPassword: 'NewPass5678' });

		expect(res.status).toBe(401);
	});
});

// ─── Reset Password ───────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
	async function resetPassword(token: string, newPassword: string) {
		return request(app).post('/api/auth/reset-password').send({ token, newPassword });
	}

	async function createResetToken(userId: number): Promise<string> {
		const rawToken = crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
		await prisma.passwordResetToken.create({
			data: {
				passwordResetToken: tokenHash,
				userId,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000),
			},
		});
		return rawToken;
	}

	async function getResetToken(): Promise<string> {
		await register();
		const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
		return createResetToken(user!.id);
	}

	it('returns 200 with user, accessToken, and message', async () => {
		const token = await getResetToken();
		const res = await resetPassword(token, 'NewPass5678');

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken');
		expect(res.body).toHaveProperty('message');
		expect(res.body.user).toMatchObject({ email: TEST_USER.email });
		expect(res.body.user).not.toHaveProperty('password');
	});

	it('sets a new refreshToken cookie', async () => {
		const token = await getResetToken();
		const res = await resetPassword(token, 'NewPass5678');

		const cookies = getCookies(res);
		expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
		expect(cookies.some((c) => c.toLowerCase().includes('httponly'))).toBe(true);
	});

	it('deletes the reset token row after use', async () => {
		const token = await getResetToken();
		const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });

		await resetPassword(token, 'NewPass5678');

		const row = await prisma.passwordResetToken.findFirst({ where: { userId: user!.id } });
		expect(row).toBeNull();
	});

	it('token cannot be reused after a successful reset', async () => {
		const token = await getResetToken();
		await resetPassword(token, 'NewPass5678');

		const res = await resetPassword(token, 'AnotherPass99');
		expect(res.status).toBe(401);
	});

	it('invalidates all existing refresh tokens on reset', async () => {
		await register();
		const loginRes = await login();
		const oldCookie = getCookies(loginRes).join('; ');

		const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
		const token = await createResetToken(user!.id);
		await resetPassword(token, 'NewPass5678');

		const res = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
		expect(res.status).toBe(401);
	});

	it('returns 401 for an invalid token', async () => {
		const res = await resetPassword('invalidtoken', 'NewPass5678');
		expect(res.status).toBe(401);
	});

	it('returns 401 for an expired token', async () => {
		await register();
		const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
		const rawToken = 'somerawtoken';
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

		await prisma.passwordResetToken.create({
			data: {
				passwordResetToken: tokenHash,
				userId: user!.id,
				expiresAt: new Date(Date.now() - 1000),
			},
		});

		const res = await resetPassword(rawToken, 'NewPass5678');
		expect(res.status).toBe(401);
	});

	it('returns 400 for a weak newPassword', async () => {
		const token = await getResetToken();
		const res = await resetPassword(token, 'weak');
		expect(res.status).toBe(400);
	});

	it('returns 400 when token is missing', async () => {
		const res = await request(app)
			.post('/api/auth/reset-password')
			.send({ newPassword: 'NewPass5678' });
		expect(res.status).toBe(400);
	});
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
	async function forgotPassword(email: string) {
		return request(app).post('/api/auth/forgot-password').send({ email });
	}

	it('returns 200 when user exists', async () => {
		await register();
		const res = await forgotPassword(TEST_USER.email);
		expect(res.status).toBe(200);
	});

	it('returns 200 when user does not exist (never reveal email existence)', async () => {
		const res = await forgotPassword('nobody@example.com');
		expect(res.status).toBe(200);
	});

	it('creates a PasswordResetToken row in the DB when user exists', async () => {
		await register();
		const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });

		await forgotPassword(TEST_USER.email);

		const token = await prisma.passwordResetToken.findFirst({ where: { userId: user!.id } });
		expect(token).not.toBeNull();
		expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());
	});

	it('does not create a token when user does not exist', async () => {
		await forgotPassword('nobody@example.com');

		const count = await prisma.passwordResetToken.count();
		expect(count).toBe(0);
	});

	it('replaces an existing token on a second request', async () => {
		await register();
		const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });

		await forgotPassword(TEST_USER.email);
		const first = await prisma.passwordResetToken.findFirst({ where: { userId: user!.id } });

		await forgotPassword(TEST_USER.email);
		const second = await prisma.passwordResetToken.findFirst({ where: { userId: user!.id } });
		const count = await prisma.passwordResetToken.count({ where: { userId: user!.id } });

		expect(count).toBe(1);
		expect(second!.passwordResetToken).not.toBe(first!.passwordResetToken);
	});

	it('queues a password-reset email to the correct address', async () => {
		await register();
		await forgotPassword(TEST_USER.email);

		expect(vi.mocked(emailQueue.add)).toHaveBeenCalledWith(
			'password-reset',
			expect.objectContaining({ email: TEST_USER.email }),
		);
	});

	it('does not queue an email when user does not exist', async () => {
		await forgotPassword('nobody@example.com');
		expect(vi.mocked(emailQueue.add)).not.toHaveBeenCalledWith(
			'password-reset',
			expect.anything(),
		);
	});

	it('returns 400 for invalid email format', async () => {
		const res = await forgotPassword('not-an-email');
		expect(res.status).toBe(400);
	});
});

// ─── Google OAuth Exchange ────────────────────────────────────────────────────

describe('POST /api/auth/google/exchange', () => {
	async function seedOAuthCode(code: string) {
		const user = await prisma.user.create({
			data: {
				email: 'google@example.com',
				name: 'Google User',
				googleId: 'gid-exchange-test',
			},
		});
		const payload = {
			accessToken: 'test-access-token',
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				hasPassword: false,
				createdAt: user.createdAt,
			},
		};
		await redis.setex(`oauth:code:${code}`, 30, JSON.stringify(payload));
		return payload;
	}

	it('returns 200 with accessToken and user for a valid code', async () => {
		const code = crypto.randomUUID();
		const payload = await seedOAuthCode(code);

		const res = await request(app).post('/api/auth/google/exchange').send({ code });

		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('accessToken', payload.accessToken);
		expect(res.body.user).toMatchObject({ email: 'google@example.com' });
	});

	it('deletes the Redis key after exchange (one-time use)', async () => {
		const code = crypto.randomUUID();
		await seedOAuthCode(code);

		await request(app).post('/api/auth/google/exchange').send({ code });

		const key = await redis.get(`oauth:code:${code}`);
		expect(key).toBeNull();
	});

	it('returns 401 on replay (one-time use enforced)', async () => {
		const code = crypto.randomUUID();
		await seedOAuthCode(code);

		await request(app).post('/api/auth/google/exchange').send({ code });
		const res = await request(app).post('/api/auth/google/exchange').send({ code });

		expect(res.status).toBe(401);
	});

	it('returns 401 for a valid UUID not present in Redis', async () => {
		const res = await request(app)
			.post('/api/auth/google/exchange')
			.send({ code: crypto.randomUUID() });

		expect(res.status).toBe(401);
	});

	it('returns 400 for a non-UUID code format', async () => {
		const res = await request(app)
			.post('/api/auth/google/exchange')
			.send({ code: 'not-a-uuid' });

		expect(res.status).toBe(400);
	});
});
