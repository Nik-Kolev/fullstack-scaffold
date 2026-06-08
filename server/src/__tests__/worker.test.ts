import { describe, it, expect, afterAll, vi } from 'vitest';
import { emailQueue } from '../lib/bullmq.js';
import emailWorker, { handleEmailJob } from '../workers/email.worker.js';
import { Job, QueueEvents } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis.js';

const queueEvents = new QueueEvents('emails', { connection: redisConnectionOptions });

describe('email worker', () => {
	afterAll(async () => {
		await emailWorker.close();
		await queueEvents.close();
		await emailQueue.obliterate({ force: true });
	});

	it('handles a welcome job', async () => {
		const consoleSpy = vi.spyOn(console, 'log');
		await handleEmailJob({ name: 'welcome', data: { email: 'test@example.com' } } as Job);
		expect(consoleSpy).toHaveBeenCalledWith('Sending welcome email to', 'test@example.com');
	});

	it('completes a welcome job end to end', async () => {
		const job = await emailQueue.add('welcome', { email: 'test@example.com' });
		await expect(job.waitUntilFinished(queueEvents)).resolves.not.toThrow();
	});
});
