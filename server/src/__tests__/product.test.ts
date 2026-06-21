import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { uploadFile, deleteFile } from '../lib/r2.js';

vi.mock('../lib/bullmq.js', () => ({ emailQueue: { add: vi.fn() } }));

vi.mock('../lib/stripe.js', () => ({
	default: {
		customers: { create: vi.fn() },
		checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
		webhooks: { constructEvent: vi.fn() },
	},
}));

vi.mock('../lib/r2.js', () => ({
	uploadFile: vi.fn(),
	deleteFile: vi.fn(),
	default: {},
}));

const mockUploadFile = vi.mocked(uploadFile);
const mockDeleteFile = vi.mocked(deleteFile);

const USER = { email: 'product-user@example.com', password: 'Test1234', name: 'User' };
const ADMIN = { email: 'product-admin@example.com', password: 'Test1234', name: 'Admin' };
const PRODUCT_DATA = { name: 'Widget', price: 999 };

async function loginAs(credentials: { email: string; password: string }) {
	const res = await request(app)
		.post('/api/auth/login')
		.send({ email: credentials.email, password: credentials.password });
	return res.body.accessToken as string;
}

async function registerAndLoginAsUser() {
	await request(app).post('/api/auth/register').send(USER);
	return loginAs(USER);
}

async function registerAndLoginAsAdmin() {
	await request(app).post('/api/auth/register').send(ADMIN);
	await prisma.user.update({ where: { email: ADMIN.email }, data: { role: 'admin' } });
	return loginAs(ADMIN);
}

async function seedProduct(overrides: object = {}) {
	return prisma.product.create({
		data: { ...PRODUCT_DATA, ...overrides } as Parameters<
			typeof prisma.product.create
		>[0]['data'],
	});
}

beforeEach(async () => {
	await prisma.payment.deleteMany();
	await prisma.product.deleteMany();
	await prisma.userFile.deleteMany();
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
	await redis.flushdb();
	vi.resetAllMocks();
});

afterAll(async () => {
	await prisma.$disconnect();
	await redis.quit();
});

// ─── GET /api/product ────────────────────────────────────────────────────────

describe('GET /api/product', () => {
	it('returns empty array when no products exist', async () => {
		const res = await request(app).get('/api/product');
		expect(res.status).toBe(200);
		expect(res.body.products).toEqual([]);
	});

	it('returns only active products', async () => {
		await seedProduct({ name: 'Active A' });
		await seedProduct({ name: 'Active B' });
		await seedProduct({ name: 'Inactive', isActive: false });

		const res = await request(app).get('/api/product');
		expect(res.status).toBe(200);
		expect(res.body.products).toHaveLength(2);
		expect(res.body.products.map((p: { name: string }) => p.name)).not.toContain('Inactive');
	});

	it('does not require authentication', async () => {
		const res = await request(app).get('/api/product');
		expect(res.status).toBe(200);
	});
});

// ─── GET /api/product/:id ────────────────────────────────────────────────────

describe('GET /api/product/:id', () => {
	it('returns a product by id', async () => {
		const product = await seedProduct();

		const res = await request(app).get(`/api/product/${product.id}`);
		expect(res.status).toBe(200);
		expect(res.body.product).toMatchObject({ id: product.id, name: 'Widget', price: 999 });
	});

	it('returns 404 for non-existent id', async () => {
		const res = await request(app).get('/api/product/99999');
		expect(res.status).toBe(404);
	});

	it('returns inactive product by id — allows admin lookup of deactivated products', async () => {
		const inactive = await seedProduct({ isActive: false });

		const res = await request(app).get(`/api/product/${inactive.id}`);
		expect(res.status).toBe(200);
		expect(res.body.product.isActive).toBe(false);
	});
});

// ─── POST /api/product ───────────────────────────────────────────────────────

describe('POST /api/product', () => {
	it('returns 401 with no Authorization header', async () => {
		const res = await request(app).post('/api/product').send(PRODUCT_DATA);
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-admin user', async () => {
		const token = await registerAndLoginAsUser();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send(PRODUCT_DATA);
		expect(res.status).toBe(403);
	});

	it('returns 400 when name is missing', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ price: 999 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when price is missing', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Widget' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when price is a float', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Widget', price: 9.99 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when price is zero', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Widget', price: 0 });
		expect(res.status).toBe(400);
	});

	it('returns 400 when imageUrl is not a valid URL', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ ...PRODUCT_DATA, imageUrl: 'not-a-url' });
		expect(res.status).toBe(400);
	});

	it('returns 201 with product using required fields only', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send(PRODUCT_DATA);

		expect(res.status).toBe(201);
		expect(res.body.product).toMatchObject({ name: 'Widget', price: 999, isActive: true });
		expect(res.body.product.id).toBeDefined();
	});

	it('returns 201 with all optional fields', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({
				name: 'Deluxe Widget',
				description: 'Top quality widget',
				price: 2999,
				imageUrl: 'https://example.com/widget.png',
			});

		expect(res.status).toBe(201);
		expect(res.body.product).toMatchObject({
			name: 'Deluxe Widget',
			description: 'Top quality widget',
			price: 2999,
			imageUrl: 'https://example.com/widget.png',
		});
	});
});

// ─── PUT /api/product/:id ────────────────────────────────────────────────────

describe('PUT /api/product/:id', () => {
	it('returns 401 with no Authorization header', async () => {
		const product = await seedProduct();
		const res = await request(app).put(`/api/product/${product.id}`).send({ name: 'Updated' });
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-admin user', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();
		const res = await request(app)
			.put(`/api/product/${product.id}`)
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Updated' });
		expect(res.status).toBe(403);
	});

	it('returns 404 for non-existent product', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.put('/api/product/99999')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Updated' });
		expect(res.status).toBe(404);
	});

	it('returns 400 when body is empty', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();
		const res = await request(app)
			.put(`/api/product/${product.id}`)
			.set('Authorization', `Bearer ${token}`)
			.send({});
		expect(res.status).toBe(400);
	});

	it('returns 200 and updates the product', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();
		const res = await request(app)
			.put(`/api/product/${product.id}`)
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Updated Widget', price: 1499 });

		expect(res.status).toBe(200);
		expect(res.body.product).toMatchObject({ name: 'Updated Widget', price: 1499 });

		const inDb = await prisma.product.findUnique({ where: { id: product.id } });
		expect(inDb?.name).toBe('Updated Widget');
		expect(inDb?.price).toBe(1499);
	});
});

// ─── DELETE /api/product/:id ─────────────────────────────────────────────────

describe('DELETE /api/product/:id', () => {
	it('returns 401 with no Authorization header', async () => {
		const product = await seedProduct();
		const res = await request(app).delete(`/api/product/${product.id}`);
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-admin user', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();
		const res = await request(app)
			.delete(`/api/product/${product.id}`)
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(403);
	});

	it('returns 404 for non-existent product', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.delete('/api/product/99999')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(404);
	});

	it('returns 204, sets isActive to false, and nulls imageUrl', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();
		const res = await request(app)
			.delete(`/api/product/${product.id}`)
			.set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(204);

		const inDb = await prisma.product.findUnique({ where: { id: product.id } });
		expect(inDb?.isActive).toBe(false);
		expect(inDb?.imageUrl).toBeNull();
	});

	it('deletes R2 image when deactivating a product that has one', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct({
			imageUrl: 'https://r2.example.com/products/1/img.jpg',
		});

		await request(app)
			.delete(`/api/product/${product.id}`)
			.set('Authorization', `Bearer ${token}`);

		expect(mockDeleteFile).toHaveBeenCalledOnce();

		const inDb = await prisma.product.findUnique({ where: { id: product.id } });
		expect(inDb?.imageUrl).toBeNull();
	});

	it('deactivated product no longer appears in GET /api/product', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();

		await request(app)
			.delete(`/api/product/${product.id}`)
			.set('Authorization', `Bearer ${token}`);

		const res = await request(app).get('/api/product');
		expect(res.body.products).toHaveLength(0);
	});
});

// ─── POST /api/product/:id/image ─────────────────────────────────────────────

describe('POST /api/product/:id/image', () => {
	it('returns 401 with no Authorization header', async () => {
		const product = await seedProduct();
		const res = await request(app)
			.post(`/api/product/${product.id}/image`)
			.attach('image', Buffer.from('fake'), {
				filename: 'test.jpg',
				contentType: 'image/jpeg',
			});
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-admin user', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();
		const res = await request(app)
			.post(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`)
			.attach('image', Buffer.from('fake'), {
				filename: 'test.jpg',
				contentType: 'image/jpeg',
			});
		expect(res.status).toBe(403);
	});

	it('returns 404 for non-existent product', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product/99999/image')
			.set('Authorization', `Bearer ${token}`)
			.attach('image', Buffer.from('fake'), {
				filename: 'test.jpg',
				contentType: 'image/jpeg',
			});
		expect(res.status).toBe(404);
	});

	it('returns 400 when no file is attached', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();
		const res = await request(app)
			.post(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(400);
	});

	it('returns 400 for non-image file type (e.g. PDF)', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();
		const res = await request(app)
			.post(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`)
			.attach('image', Buffer.from('%PDF'), {
				filename: 'doc.pdf',
				contentType: 'application/pdf',
			});
		expect(res.status).toBe(400);
	});

	it('returns 200 and sets imageUrl on the product', async () => {
		mockUploadFile.mockResolvedValueOnce('https://r2.example.com/products/1/uuid.jpg');
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();

		const res = await request(app)
			.post(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`)
			.attach('image', Buffer.from('fake'), {
				filename: 'test.jpg',
				contentType: 'image/jpeg',
			});

		expect(res.status).toBe(200);
		expect(res.body.product.imageUrl).toBe('https://r2.example.com/products/1/uuid.jpg');

		const inDb = await prisma.product.findUnique({ where: { id: product.id } });
		expect(inDb?.imageUrl).toBe('https://r2.example.com/products/1/uuid.jpg');
	});

	it('deletes old R2 image before uploading the replacement', async () => {
		mockUploadFile.mockResolvedValueOnce('https://r2.example.com/products/1/new.jpg');
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct({
			imageUrl: 'https://r2.example.com/products/1/old.jpg',
		});

		await request(app)
			.post(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`)
			.attach('image', Buffer.from('fake'), {
				filename: 'new.jpg',
				contentType: 'image/jpeg',
			});

		expect(mockDeleteFile).toHaveBeenCalledOnce();

		const inDb = await prisma.product.findUnique({ where: { id: product.id } });
		expect(inDb?.imageUrl).toBe('https://r2.example.com/products/1/new.jpg');
	});
});
