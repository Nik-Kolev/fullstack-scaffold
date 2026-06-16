import request from 'supertest';
import app from '../app.js';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { uploadFile, deleteFile } from '../lib/r2.js';

vi.mock('../lib/bullmq.js', () => ({
	emailQueue: { add: vi.fn() },
}));

vi.mock('../lib/r2.js', () => ({
	uploadFile: vi.fn(async (key: string) => `https://fake-public-url.test/${key}`),
	deleteFile: vi.fn(),
}));

const TEST_USER = { email: 'upload-test@example.com', password: 'Test1234', name: 'Uploader' };

beforeEach(async () => {
	await prisma.userFile.deleteMany();
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
	await redis.flushdb();
	vi.mocked(uploadFile).mockClear();
	vi.mocked(deleteFile).mockClear();
});

afterAll(async () => {
	await prisma.$disconnect();
	await redis.quit();
});

async function registerAndLogin() {
	await request(app).post('/api/auth/register').send(TEST_USER);
	const res = await request(app)
		.post('/api/auth/login')
		.send({ email: TEST_USER.email, password: TEST_USER.password });
	return res.body.accessToken as string;
}

function uploadReq(accessToken: string) {
	return request(app).post('/api/upload').set('Authorization', `Bearer ${accessToken}`);
}

describe('POST /api/upload', () => {
	it('uploads a single file and returns fileData', async () => {
		const accessToken = await registerAndLogin();

		const res = await uploadReq(accessToken)
			.field('folderName', 'images')
			.attach('files', Buffer.from('fake image content'), {
				filename: 'photo.png',
				contentType: 'image/png',
			});

		expect(res.status).toBe(200);
		expect(res.body.fileData).toHaveLength(1);
		expect(res.body.fileData[0]).toMatchObject({
			originalName: 'photo.png',
			folder: 'images',
			mimeType: 'image/png',
		});
	});

	it('uploads multiple files in one request', async () => {
		const accessToken = await registerAndLogin();

		const res = await uploadReq(accessToken)
			.field('folderName', 'documents')
			.attach('files', Buffer.from('file one'), { filename: 'a.png', contentType: 'image/png' })
			.attach('files', Buffer.from('file two'), { filename: 'b.png', contentType: 'image/png' });

		expect(res.status).toBe(200);
		expect(res.body.fileData).toHaveLength(2);
	});

	it('persists uploaded files to the database', async () => {
		const accessToken = await registerAndLogin();

		await uploadReq(accessToken)
			.field('folderName', 'images')
			.attach('files', Buffer.from('fake image content'), {
				filename: 'photo.png',
				contentType: 'image/png',
			});

		const rows = await prisma.userFile.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ originalName: 'photo.png', folder: 'images' });
	});

	it('builds the R2 key as {userId}/{folder}/uuid.ext', async () => {
		const accessToken = await registerAndLogin();
		const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });

		await uploadReq(accessToken)
			.field('folderName', 'images')
			.attach('files', Buffer.from('fake image content'), {
				filename: 'photo.png',
				contentType: 'image/png',
			});

		expect(uploadFile).toHaveBeenCalledWith(
			expect.stringMatching(new RegExp(`^${user.id}/images/.+\\.png$`)),
			expect.any(Buffer),
			'image/png',
		);
	});

	it('returns 401 with no access token', async () => {
		const res = await request(app)
			.post('/api/upload')
			.field('folderName', 'images')
			.attach('files', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' });

		expect(res.status).toBe(401);
		expect(uploadFile).not.toHaveBeenCalled();
	});

	it('returns 400 when no files are attached', async () => {
		const accessToken = await registerAndLogin();

		const res = await uploadReq(accessToken).field('folderName', 'images');

		expect(res.status).toBe(400);
		expect(uploadFile).not.toHaveBeenCalled();
	});

	it('returns 400 when folderName is missing', async () => {
		const accessToken = await registerAndLogin();

		const res = await uploadReq(accessToken).attach('files', Buffer.from('x'), {
			filename: 'a.png',
			contentType: 'image/png',
		});

		expect(res.status).toBe(400);
	});

	it('returns 400 for a disallowed file type', async () => {
		const accessToken = await registerAndLogin();

		const res = await uploadReq(accessToken)
			.field('folderName', 'images')
			.attach('files', Buffer.from('exe content'), {
				filename: 'virus.exe',
				contentType: 'application/x-msdownload',
			});

		expect(res.status).toBe(400);
		expect(uploadFile).not.toHaveBeenCalled();
	});

	it('returns 400 when a file exceeds the 5MB limit', async () => {
		const accessToken = await registerAndLogin();
		const bigBuffer = Buffer.alloc(6 * 1024 * 1024);

		const res = await uploadReq(accessToken)
			.field('folderName', 'images')
			.attach('files', bigBuffer, { filename: 'big.png', contentType: 'image/png' });

		expect(res.status).toBe(400);
	});

	it('returns 400 when more than 10 files are attached', async () => {
		const accessToken = await registerAndLogin();
		let req = uploadReq(accessToken).field('folderName', 'images');

		for (let i = 0; i < 11; i++) {
			req = req.attach('files', Buffer.from(`file ${i}`), {
				filename: `f${i}.png`,
				contentType: 'image/png',
			});
		}

		const res = await req;
		expect(res.status).toBe(400);
	});
});

describe('DELETE /api/upload/:key', () => {
	async function uploadOneFile(accessToken: string) {
		const res = await uploadReq(accessToken)
			.field('folderName', 'images')
			.attach('files', Buffer.from('fake image content'), {
				filename: 'photo.png',
				contentType: 'image/png',
			});
		return res.body.fileData[0].key as string;
	}

	it('deletes an owned file from R2 and the database', async () => {
		const accessToken = await registerAndLogin();
		const key = await uploadOneFile(accessToken);

		const res = await request(app)
			.delete(`/api/upload/${encodeURIComponent(key)}`)
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(204);
		expect(deleteFile).toHaveBeenCalledWith(key);
		expect(await prisma.userFile.findUnique({ where: { key } })).toBeNull();
	});

	it('returns 404 for a key that does not exist', async () => {
		const accessToken = await registerAndLogin();

		const res = await request(app)
			.delete(`/api/upload/${encodeURIComponent('999/images/does-not-exist.png')}`)
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(404);
		expect(deleteFile).not.toHaveBeenCalled();
	});

	it('returns 404 when the file belongs to a different user', async () => {
		const ownerToken = await registerAndLogin();
		const key = await uploadOneFile(ownerToken);

		const OTHER_USER = { email: 'other-upload-test@example.com', password: 'Test1234', name: 'Other' };
		await request(app).post('/api/auth/register').send(OTHER_USER);
		const otherLogin = await request(app)
			.post('/api/auth/login')
			.send({ email: OTHER_USER.email, password: OTHER_USER.password });

		const res = await request(app)
			.delete(`/api/upload/${encodeURIComponent(key)}`)
			.set('Authorization', `Bearer ${otherLogin.body.accessToken}`);

		expect(res.status).toBe(404);
		expect(deleteFile).not.toHaveBeenCalled();
		expect(await prisma.userFile.findUnique({ where: { key } })).not.toBeNull();
	});

	it('returns 401 with no access token', async () => {
		const res = await request(app).delete(`/api/upload/${encodeURIComponent('1/images/x.png')}`);

		expect(res.status).toBe(401);
		expect(deleteFile).not.toHaveBeenCalled();
	});
});

describe('GET /api/upload/folder/:name', () => {
	async function uploadToFolder(accessToken: string, folder: string) {
		await uploadReq(accessToken)
			.field('folderName', folder)
			.attach('files', Buffer.from('fake content'), { filename: 'photo.png', contentType: 'image/png' });
	}

	it('returns files in the requested folder', async () => {
		const accessToken = await registerAndLogin();
		await uploadToFolder(accessToken, 'images');

		const res = await request(app)
			.get('/api/upload/folder/images')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.files).toHaveLength(1);
		expect(res.body.files[0]).toMatchObject({ folder: 'images', originalName: 'photo.png' });
	});

	it('returns an empty array when the folder has no files', async () => {
		const accessToken = await registerAndLogin();

		const res = await request(app)
			.get('/api/upload/folder/documents')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.files).toHaveLength(0);
	});

	it('returns only files from the requested folder, not other folders', async () => {
		const accessToken = await registerAndLogin();
		await uploadToFolder(accessToken, 'images');
		await uploadToFolder(accessToken, 'documents');

		const res = await request(app)
			.get('/api/upload/folder/images')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.files).toHaveLength(1);
		expect(res.body.files[0].folder).toBe('images');
	});

	it('does not return files belonging to another user', async () => {
		const ownerToken = await registerAndLogin();
		await uploadToFolder(ownerToken, 'images');

		const OTHER_USER = { email: 'other-folder-test@example.com', password: 'Test1234', name: 'Other' };
		await request(app).post('/api/auth/register').send(OTHER_USER);
		const otherLogin = await request(app)
			.post('/api/auth/login')
			.send({ email: OTHER_USER.email, password: OTHER_USER.password });

		const res = await request(app)
			.get('/api/upload/folder/images')
			.set('Authorization', `Bearer ${otherLogin.body.accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.files).toHaveLength(0);
	});

	it('returns 401 with no access token', async () => {
		const res = await request(app).get('/api/upload/folder/images');

		expect(res.status).toBe(401);
	});
});

describe('GET /api/upload/folders', () => {
	async function uploadToFolder(accessToken: string, folder: string) {
		await uploadReq(accessToken)
			.field('folderName', folder)
			.attach('files', Buffer.from('fake content'), { filename: 'photo.png', contentType: 'image/png' });
	}

	it('returns all distinct folder names for the user', async () => {
		const accessToken = await registerAndLogin();
		await uploadToFolder(accessToken, 'images');
		await uploadToFolder(accessToken, 'documents');

		const res = await request(app)
			.get('/api/upload/folders')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.folders).toHaveLength(2);
		expect(res.body.folders).toEqual(expect.arrayContaining(['images', 'documents']));
	});

	it('does not duplicate folder names when multiple files share the same folder', async () => {
		const accessToken = await registerAndLogin();
		await uploadToFolder(accessToken, 'images');
		await uploadToFolder(accessToken, 'images');

		const res = await request(app)
			.get('/api/upload/folders')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.folders).toHaveLength(1);
		expect(res.body.folders[0]).toBe('images');
	});

	it('returns an empty array when the user has no files', async () => {
		const accessToken = await registerAndLogin();

		const res = await request(app)
			.get('/api/upload/folders')
			.set('Authorization', `Bearer ${accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.folders).toHaveLength(0);
	});

	it('does not return folders belonging to another user', async () => {
		const ownerToken = await registerAndLogin();
		await uploadToFolder(ownerToken, 'images');

		const OTHER_USER = { email: 'other-folders-test@example.com', password: 'Test1234', name: 'Other' };
		await request(app).post('/api/auth/register').send(OTHER_USER);
		const otherLogin = await request(app)
			.post('/api/auth/login')
			.send({ email: OTHER_USER.email, password: OTHER_USER.password });

		const res = await request(app)
			.get('/api/upload/folders')
			.set('Authorization', `Bearer ${otherLogin.body.accessToken}`);

		expect(res.status).toBe(200);
		expect(res.body.folders).toHaveLength(0);
	});

	it('returns 401 with no access token', async () => {
		const res = await request(app).get('/api/upload/folders');

		expect(res.status).toBe(401);
	});
});
