import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import prisma from '../lib/prisma.js';

beforeEach(async () => {
	await prisma.like.deleteMany();
	await prisma.product.deleteMany();
	await prisma.productCategory.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

// ─── GET /api/category ───────────────────────────────────────────────────────

describe('GET /api/category', () => {
	it('returns an empty list when no categories exist', async () => {
		const res = await request(app).get('/api/category');
		expect(res.status).toBe(200);
		expect(res.body.categories).toEqual([]);
	});

	it('does not require authentication', async () => {
		const res = await request(app).get('/api/category');
		expect(res.status).toBe(200);
	});

	it('returns categories sorted by name', async () => {
		await prisma.productCategory.create({ data: { name: 'Widgets' } });
		await prisma.productCategory.create({ data: { name: 'Accessories' } });

		const res = await request(app).get('/api/category');

		expect(res.status).toBe(200);
		expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual([
			'Accessories',
			'Widgets',
		]);
	});
});
