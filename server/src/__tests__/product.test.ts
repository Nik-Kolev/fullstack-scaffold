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

let categoryId: number;

async function seedProduct(overrides: object = {}) {
	return prisma.product.create({
		data: {
			...PRODUCT_DATA,
			categoryId,
			color: 'black',
			shape: 'square',
			...overrides,
		} as Parameters<typeof prisma.product.create>[0]['data'],
	});
}

beforeEach(async () => {
	await prisma.like.deleteMany();
	await prisma.payment.deleteMany();
	await prisma.product.deleteMany();
	await prisma.productCategory.deleteMany();
	await prisma.userFile.deleteMany();
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
	await redis.flushdb();
	vi.resetAllMocks();

	const category = await prisma.productCategory.create({ data: { name: 'Test Category' } });
	categoryId = category.id;
});

afterAll(async () => {
	await prisma.$disconnect();
	await redis.quit();
});

// ─── GET /api/product ────────────────────────────────────────────────────────

describe('GET /api/product', () => {
	it('returns an empty result with a null nextCursor when no products exist', async () => {
		const res = await request(app).get('/api/product');
		expect(res.status).toBe(200);
		expect(res.body.products).toEqual([]);
		expect(res.body.nextCursor).toBeNull();
		expect(res.body.limit).toBe(10);
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

	it('returns 400 for invalid query params', async () => {
		const res = await request(app).get('/api/product?limit=0');
		expect(res.status).toBe(400);
	});

	it('returns 400 when limit exceeds 100', async () => {
		const res = await request(app).get('/api/product?limit=101');
		expect(res.status).toBe(400);
	});

	it('each product in the list has the expected shape', async () => {
		await seedProduct({
			description: 'A fine widget',
			imageUrl: 'https://example.com/img.png',
		});

		const res = await request(app).get('/api/product');

		expect(res.status).toBe(200);
		expect(res.body.products[0]).toMatchObject({
			id: expect.any(Number),
			name: 'Widget',
			price: 999,
			isActive: true,
			description: 'A fine widget',
			imageUrl: 'https://example.com/img.png',
		});
	});

	describe('cursor pagination', () => {
		it('returns a non-null nextCursor when more results exist beyond the limit', async () => {
			await seedProduct({ name: 'P1' });
			await seedProduct({ name: 'P2' });
			await seedProduct({ name: 'P3' });

			const res = await request(app).get('/api/product?limit=2');
			expect(res.status).toBe(200);
			expect(res.body.products).toHaveLength(2);
			expect(res.body.nextCursor).not.toBeNull();
		});

		it('returns a null nextCursor on the last page', async () => {
			await seedProduct({ name: 'P1' });
			await seedProduct({ name: 'P2' });

			const res = await request(app).get('/api/product?limit=10');
			expect(res.status).toBe(200);
			expect(res.body.products).toHaveLength(2);
			expect(res.body.nextCursor).toBeNull();
		});

		it('walks through all pages via nextCursor with no overlap or gaps', async () => {
			const created = [];
			for (let i = 0; i < 5; i++) {
				created.push(await seedProduct({ name: `Item ${i}` }));
			}

			const seenIds = new Set<number>();
			let cursor: string | undefined;
			let pages = 0;

			do {
				const res = await request(app).get(
					`/api/product?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
				);
				expect(res.status).toBe(200);
				for (const p of res.body.products as { id: number }[]) {
					expect(seenIds.has(p.id)).toBe(false);
					seenIds.add(p.id);
				}
				cursor = res.body.nextCursor;
				pages++;
				expect(pages).toBeLessThan(10);
			} while (cursor);

			expect(seenIds.size).toBe(5);
			expect(created.every((p) => seenIds.has(p.id))).toBe(true);
		});

		it('returns 400 for a malformed cursor', async () => {
			const res = await request(app).get('/api/product?cursor=not-valid-base64json');
			expect(res.status).toBe(400);
		});

		it('returns 400 for a cursor missing an id', async () => {
			const badCursor = Buffer.from(
				JSON.stringify({
					sortField: 'createdAt',
					order: 'desc',
					sortValue: new Date().toISOString(),
				}),
			).toString('base64url');

			const res = await request(app).get(`/api/product?cursor=${badCursor}`);
			expect(res.status).toBe(400);
		});

		it('returns 400 when a cursor is reused with a different sortBy/order', async () => {
			await seedProduct({ name: 'P1', price: 1000 });
			await seedProduct({ name: 'P2', price: 2000 });

			const page1 = await request(app).get('/api/product?sortBy=price&order=asc&limit=1');
			expect(page1.body.nextCursor).not.toBeNull();

			const res = await request(app).get(
				`/api/product?sortBy=likesCount&order=desc&limit=1&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
			);
			expect(res.status).toBe(400);
		});

		it('does not skip or duplicate items that tie on the sort field across a page boundary', async () => {
			const a = await seedProduct({ name: 'TieA', price: 1000 });
			const b = await seedProduct({ name: 'TieB', price: 1000 });
			const c = await seedProduct({ name: 'TieC', price: 1000 });

			const page1 = await request(app).get('/api/product?sortBy=price&order=asc&limit=2');
			expect(page1.status).toBe(200);
			expect(page1.body.products).toHaveLength(2);
			expect(page1.body.nextCursor).not.toBeNull();

			const page2 = await request(app).get(
				`/api/product?sortBy=price&order=asc&limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
			);
			expect(page2.status).toBe(200);

			const seenIds = [...page1.body.products, ...page2.body.products].map(
				(p: { id: number }) => p.id,
			);
			expect(new Set(seenIds).size).toBe(3);
			expect(seenIds.sort()).toEqual([a.id, b.id, c.id].sort());
		});
	});

	describe('filters', () => {
		it('filters by categoryId', async () => {
			const otherCategory = await prisma.productCategory.create({ data: { name: 'Other' } });
			await seedProduct({ name: 'InCategory' });
			await seedProduct({ name: 'OtherCategory', categoryId: otherCategory.id });

			const res = await request(app).get(`/api/product?categoryId=${categoryId}`);
			expect(res.status).toBe(200);
			expect(res.body.products.map((p: { name: string }) => p.name)).toEqual(['InCategory']);
		});

		it('filters by minPrice and maxPrice', async () => {
			await seedProduct({ name: 'Cheap', price: 500 });
			await seedProduct({ name: 'Mid', price: 1500 });
			await seedProduct({ name: 'Expensive', price: 5000 });

			const res = await request(app).get('/api/product?minPrice=1000&maxPrice=2000');
			expect(res.status).toBe(200);
			expect(res.body.products.map((p: { name: string }) => p.name)).toEqual(['Mid']);
		});

		it('filters by color and shape, case-insensitively', async () => {
			await seedProduct({ name: 'RedSquare', color: 'Red', shape: 'Square' });
			await seedProduct({ name: 'BlueCircle', color: 'Blue', shape: 'Circle' });

			const res = await request(app).get('/api/product?color=red&shape=square');
			expect(res.status).toBe(200);
			expect(res.body.products.map((p: { name: string }) => p.name)).toEqual(['RedSquare']);
		});
	});

	describe('search', () => {
		it('matches a partial, case-insensitive substring of the name with no false positives', async () => {
			await seedProduct({ name: 'Wireless Mouse' });
			await seedProduct({ name: 'Mechanical Keyboard' });

			const res = await request(app).get('/api/product?search=mouse');
			expect(res.status).toBe(200);
			expect(res.body.products.map((p: { name: string }) => p.name)).toEqual([
				'Wireless Mouse',
			]);
		});

		it('is case-insensitive', async () => {
			await seedProduct({ name: 'Wireless Mouse' });

			const res = await request(app).get('/api/product?search=MOUSE');
			expect(res.status).toBe(200);
			expect(res.body.products.map((p: { name: string }) => p.name)).toEqual([
				'Wireless Mouse',
			]);
		});

		it('composes with other filters', async () => {
			const otherCategory = await prisma.productCategory.create({ data: { name: 'Other' } });
			await seedProduct({ name: 'Wireless Mouse' });
			await seedProduct({ name: 'Wireless Mouse', categoryId: otherCategory.id });

			const res = await request(app).get(
				`/api/product?search=mouse&categoryId=${categoryId}`,
			);
			expect(res.status).toBe(200);
			expect(res.body.products).toHaveLength(1);
		});
	});

	describe('sorting', () => {
		it('defaults to newest first', async () => {
			const older = await seedProduct({ name: 'Older', createdAt: new Date('2024-01-01') });
			const newer = await seedProduct({ name: 'Newer', createdAt: new Date('2024-06-01') });

			const res = await request(app).get('/api/product');
			expect(res.status).toBe(200);
			expect(res.body.products[0].id).toBe(newer.id);
			expect(res.body.products[1].id).toBe(older.id);
		});

		it('sorts by price ascending', async () => {
			await seedProduct({ name: 'Expensive', price: 5000 });
			await seedProduct({ name: 'Cheap', price: 500 });

			const res = await request(app).get('/api/product?sortBy=price&order=asc');
			expect(res.status).toBe(200);
			expect(res.body.products.map((p: { name: string }) => p.name)).toEqual([
				'Cheap',
				'Expensive',
			]);
		});

		it('sorts by likesCount descending', async () => {
			const lessLiked = await seedProduct({ name: 'LessLiked', likesCount: 1 });
			const moreLiked = await seedProduct({ name: 'MoreLiked', likesCount: 5 });

			const res = await request(app).get('/api/product?sortBy=likesCount&order=desc');
			expect(res.status).toBe(200);
			expect(res.body.products.map((p: { id: number }) => p.id)).toEqual([
				moreLiked.id,
				lessLiked.id,
			]);
		});
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
			.send({ price: 999, categoryId, color: 'black', shape: 'square' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when price is missing', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Widget', categoryId, color: 'black', shape: 'square' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when price is a float', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Widget', price: 9.99, categoryId, color: 'black', shape: 'square' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when price is zero', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Widget', price: 0, categoryId, color: 'black', shape: 'square' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when categoryId is missing', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ ...PRODUCT_DATA, color: 'black', shape: 'square' });
		expect(res.status).toBe(400);
	});

	it('returns 400 when imageUrl is not a valid URL', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({
				...PRODUCT_DATA,
				categoryId,
				color: 'black',
				shape: 'square',
				imageUrl: 'not-a-url',
			});
		expect(res.status).toBe(400);
	});

	it('returns 400 when quantity exceeds Postgres Int range — Zod has no upper bound, Postgres does', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({
				...PRODUCT_DATA,
				categoryId,
				color: 'black',
				shape: 'square',
				quantity: 99999999999,
			});
		expect(res.status).toBe(400);
	});

	it('returns 201 with product using required fields only', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ ...PRODUCT_DATA, categoryId, color: 'black', shape: 'square' });

		expect(res.status).toBe(201);
		expect(res.body.product).toMatchObject({
			name: 'Widget',
			price: 999,
			isActive: true,
			categoryId,
			color: 'Black',
			shape: 'Square',
			quantity: 0,
		});
		expect(res.body.product.id).toBeDefined();
	});

	it('normalizes color and shape to title case regardless of input casing', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.send({ ...PRODUCT_DATA, categoryId, color: 'bLACK', shape: 'SQUARE' });

		expect(res.status).toBe(201);
		expect(res.body.product.color).toBe('Black');
		expect(res.body.product.shape).toBe('Square');
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
				categoryId,
				color: 'red',
				shape: 'circle',
				quantity: 5,
				discountPercent: 10,
			});

		expect(res.status).toBe(201);
		expect(res.body.product).toMatchObject({
			name: 'Deluxe Widget',
			description: 'Top quality widget',
			price: 2999,
			imageUrl: 'https://example.com/widget.png',
			quantity: 5,
			discountPercent: 10,
		});
	});

	it('returns 201 with imageUrl when image file is attached', async () => {
		mockUploadFile.mockResolvedValueOnce('https://r2.example.com/products/1/uuid.jpg');
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.field('name', 'Widget')
			.field('price', '999')
			.field('categoryId', String(categoryId))
			.field('color', 'black')
			.field('shape', 'square')
			.attach('image', Buffer.from('fake'), {
				filename: 'img.jpg',
				contentType: 'image/jpeg',
			});

		expect(res.status).toBe(201);
		expect(res.body.product.imageUrl).toBe('https://r2.example.com/products/1/uuid.jpg');
		expect(mockUploadFile).toHaveBeenCalledOnce();
	});

	it('rolls back product creation if image upload fails', async () => {
		mockUploadFile.mockRejectedValueOnce(new Error('R2 unavailable'));
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.post('/api/product')
			.set('Authorization', `Bearer ${token}`)
			.field('name', 'Widget')
			.field('price', '999')
			.field('categoryId', String(categoryId))
			.field('color', 'black')
			.field('shape', 'square')
			.attach('image', Buffer.from('fake'), {
				filename: 'img.jpg',
				contentType: 'image/jpeg',
			});

		expect(res.status).toBe(500);
		const count = await prisma.product.count();
		expect(count).toBe(0);
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

	it('returns 500 and preserves old imageUrl when deleteFile rejects during image replacement', async () => {
		mockDeleteFile.mockRejectedValueOnce(new Error('R2 unavailable'));
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct({
			imageUrl: 'https://r2.example.com/products/1/old.jpg',
		});

		const res = await request(app)
			.post(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`)
			.attach('image', Buffer.from('fake'), {
				filename: 'new.jpg',
				contentType: 'image/jpeg',
			});

		expect(res.status).toBe(500);
		const inDb = await prisma.product.findUnique({ where: { id: product.id } });
		expect(inDb?.imageUrl).toBe('https://r2.example.com/products/1/old.jpg');
	});
});

// ─── DELETE /api/product/:id/image ───────────────────────────────────────────

describe('DELETE /api/product/:id/image', () => {
	it('returns 401 with no Authorization header', async () => {
		const product = await seedProduct({
			imageUrl: 'https://r2.example.com/products/1/img.jpg',
		});
		const res = await request(app).delete(`/api/product/${product.id}/image`);
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-admin user', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct({
			imageUrl: 'https://r2.example.com/products/1/img.jpg',
		});
		const res = await request(app)
			.delete(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(403);
	});

	it('returns 404 for non-existent product', async () => {
		const token = await registerAndLoginAsAdmin();
		const res = await request(app)
			.delete('/api/product/99999/image')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(404);
	});

	it('returns 404 when product has no image', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct();
		const res = await request(app)
			.delete(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(404);
	});

	it('returns 204, deletes from R2, nulls imageUrl, and leaves product active', async () => {
		const token = await registerAndLoginAsAdmin();
		const product = await seedProduct({
			imageUrl: 'https://r2.example.com/products/1/img.jpg',
		});

		const res = await request(app)
			.delete(`/api/product/${product.id}/image`)
			.set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(204);
		expect(mockDeleteFile).toHaveBeenCalledOnce();

		const inDb = await prisma.product.findUnique({ where: { id: product.id } });
		expect(inDb?.imageUrl).toBeNull();
		expect(inDb?.isActive).toBe(true);
	});
});

// ─── POST /api/product/:id/like ──────────────────────────────────────────────

describe('POST /api/product/:id/like', () => {
	it('returns 401 with no Authorization header', async () => {
		const product = await seedProduct();
		const res = await request(app).post(`/api/product/${product.id}/like`);
		expect(res.status).toBe(401);
	});

	it('returns 404 for non-existent product', async () => {
		const token = await registerAndLoginAsUser();
		const res = await request(app)
			.post('/api/product/99999/like')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(404);
	});

	it('returns 404 for an inactive (deactivated) product', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct({ isActive: false });
		const res = await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(404);
	});

	it('returns 200 and increments likesCount', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();

		const res = await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.product.likesCount).toBe(1);
	});

	it('creates a Like row for the user and product', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();

		await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);

		const user = await prisma.user.findUniqueOrThrow({ where: { email: USER.email } });
		const like = await prisma.like.findUnique({
			where: { productId_userId: { productId: product.id, userId: user.id } },
		});
		expect(like).not.toBeNull();
	});

	it('returns 409 when the same user likes the same product twice', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();

		await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);
		const res = await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(409);
		expect(res.body.code).toBe('ALREADY_LIKED');
	});

	it('counts likes from different users independently', async () => {
		const userToken = await registerAndLoginAsUser();
		const secondUser = {
			email: 'second-liker@example.com',
			password: 'Test1234',
			name: 'Second',
		};
		await request(app).post('/api/auth/register').send(secondUser);
		const secondToken = await loginAs(secondUser);
		const product = await seedProduct();

		await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${userToken}`);
		const res = await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${secondToken}`);

		expect(res.status).toBe(200);
		expect(res.body.product.likesCount).toBe(2);
	});
});

// ─── DELETE /api/product/:id/like ────────────────────────────────────────────

describe('DELETE /api/product/:id/like', () => {
	it('returns 401 with no Authorization header', async () => {
		const product = await seedProduct();
		const res = await request(app).delete(`/api/product/${product.id}/like`);
		expect(res.status).toBe(401);
	});

	it('returns 404 when the product was never liked by this user', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();

		const res = await request(app)
			.delete(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(404);
	});

	it('returns 200 and decrements likesCount', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();

		await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);
		const res = await request(app)
			.delete(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.product.likesCount).toBe(0);
	});

	it('removes the Like row', async () => {
		const token = await registerAndLoginAsUser();
		const product = await seedProduct();

		await request(app)
			.post(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);
		await request(app)
			.delete(`/api/product/${product.id}/like`)
			.set('Authorization', `Bearer ${token}`);

		const user = await prisma.user.findUniqueOrThrow({ where: { email: USER.email } });
		const like = await prisma.like.findUnique({
			where: { productId_userId: { productId: product.id, userId: user.id } },
		});
		expect(like).toBeNull();
	});
});
