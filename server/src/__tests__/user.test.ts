import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';

vi.mock('../lib/bullmq.js', () => ({ emailQueue: { add: vi.fn() } }));

const USER = { email: 'user@example.com', password: 'Test1234', name: 'Test User' };

async function registerAndLogin() {
	await request(app).post('/api/auth/register').send(USER);
	const res = await request(app)
		.post('/api/auth/login')
		.send({ email: USER.email, password: USER.password });
	return res.body.accessToken as string;
}

beforeEach(async () => {
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
	await redis.flushdb();
	vi.resetAllMocks();
});

afterAll(async () => {
	await prisma.$disconnect();
	await redis.quit();
});

// ─── GET /api/user/me ────────────────────────────────────────────────────────

describe('GET /api/user/me', () => {
	it('returns 401 with no Authorization header', async () => {
		const res = await request(app).get('/api/user/me');
		expect(res.status).toBe(401);
	});

	it('returns the authenticated user without password', async () => {
		const token = await registerAndLogin();
		const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.user).toMatchObject({ email: USER.email, name: USER.name });
		expect(res.body.user.password).toBeUndefined();
	});

	it('includes hasPassword field', async () => {
		const token = await registerAndLogin();
		const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);

		expect(res.body.user.hasPassword).toBe(true);
	});
});

// ─── PATCH /api/user/me ──────────────────────────────────────────────────────

describe('PATCH /api/user/me', () => {
	it('returns 401 with no Authorization header', async () => {
		const res = await request(app).patch('/api/user/me').send({ name: 'New Name' });
		expect(res.status).toBe(401);
	});

	it('returns 400 when body is empty', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({});
		expect(res.status).toBe(400);
	});

	it('returns 400 when email is invalid', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ email: 'not-an-email' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when name is empty string', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: '' });
		expect(res.status).toBe(400);
	});

	it('returns 200 and updates name', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Updated Name' });

		expect(res.status).toBe(200);
		expect(res.body.user.name).toBe('Updated Name');

		const inDb = await prisma.user.findUnique({ where: { email: USER.email } });
		expect(inDb?.name).toBe('Updated Name');
	});

	it('returns 200 and updates email', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ email: 'new@example.com' });

		expect(res.status).toBe(200);
		expect(res.body.user.email).toBe('new@example.com');
	});

	it('returns 409 when email is already taken', async () => {
		await request(app)
			.post('/api/auth/register')
			.send({ email: 'taken@example.com', password: 'Test1234', name: 'Other' });

		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ email: 'taken@example.com' });

		expect(res.status).toBe(409);
	});

	it('strips unknown fields', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Valid', role: 'admin' });

		expect(res.status).toBe(200);
		const inDb = await prisma.user.findUnique({ where: { email: USER.email } });
		expect(inDb?.role).toBe('user');
	});

	it('returns 200 when updating to the same email — idempotent', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ email: USER.email });

		expect(res.status).toBe(200);
		expect(res.body.user.email).toBe(USER.email);
	});

	it('returns 200 when updating both name and email in one request', async () => {
		const token = await registerAndLogin();
		const res = await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Both Updated', email: 'both@example.com' });

		expect(res.status).toBe(200);
		expect(res.body.user.name).toBe('Both Updated');
		expect(res.body.user.email).toBe('both@example.com');
	});

	it('GET /me reflects updated email immediately after PATCH', async () => {
		const token = await registerAndLogin();
		await request(app)
			.patch('/api/user/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ email: 'updated@example.com' });

		const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.user.email).toBe('updated@example.com');
	});
});
