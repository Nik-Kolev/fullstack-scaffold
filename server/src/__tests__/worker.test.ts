import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { emailQueue } from '../lib/bullmq.js';
import emailWorker, { handleEmailJob } from '../workers/email.worker.js';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis.js';
import { sendEmail } from '../lib/resend.js';

vi.mock('../lib/resend.js', () => ({
	sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-email/render', () => ({
	render: vi.fn().mockResolvedValue('<html>mock</html>'),
}));

const queueEvents = new QueueEvents('emails', { connection: redisConnectionOptions });

// Own queue/worker, not the shared 'emails' one — other files (e.g. auth.test.ts) enqueue real jobs there.
const e2eQueue = new Queue('emails-e2e-test', { connection: redisConnectionOptions });
const e2eWorker = new Worker('emails-e2e-test', handleEmailJob, {
	connection: redisConnectionOptions,
});
const e2eQueueEvents = new QueueEvents('emails-e2e-test', { connection: redisConnectionOptions });

describe('email worker', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterAll(async () => {
		await emailWorker.close();
		await queueEvents.close();
		await emailQueue.obliterate({ force: true });
		await emailQueue.close();
		await e2eWorker.close();
		await e2eQueueEvents.close();
		await e2eQueue.obliterate({ force: true });
		await e2eQueue.close();
	});

	it('handles a welcome job', async () => {
		await handleEmailJob({
			name: 'welcome',
			data: { name: 'Test', email: 'test@example.com' },
		} as Job);

		expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'test@example.com', subject: 'Welcome' }),
		);
	});

	it('handles a password-reset job', async () => {
		await handleEmailJob({
			name: 'password-reset',
			data: { name: 'Test', email: 'test@example.com', token: 'tok_abc123' },
		} as Job);

		expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'test@example.com', subject: 'Reset your password' }),
		);
	});

	it('handles a password-changed job', async () => {
		await handleEmailJob({
			name: 'password-changed',
			data: { name: 'Test', email: 'test@example.com' },
		} as Job);

		expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'test@example.com',
				subject: 'Your password was changed',
			}),
		);
	});

	it('throws for an unrecognised job name so BullMQ marks it failed', async () => {
		await expect(handleEmailJob({ name: 'unknown-event', data: {} } as Job)).rejects.toThrow(
			'Unknown email job: unknown-event',
		);
	});

	it('completes a welcome job end to end', async () => {
		const job = await e2eQueue.add('welcome', { name: 'Test', email: 'test@example.com' });
		await expect(job.waitUntilFinished(e2eQueueEvents)).resolves.not.toThrow();
	});
});
