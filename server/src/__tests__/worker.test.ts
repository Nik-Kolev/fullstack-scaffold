import { describe, it, expect, afterAll, vi } from 'vitest';
import { emailQueue } from '../lib/bullmq.js';
import emailWorker, { handleEmailJob } from '../workers/email.worker.js';
import { Job, QueueEvents } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis.js';
import { sendEmail } from '../lib/resend.js';

vi.mock('../lib/resend.js', () => ({
	sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-email/render', () => ({
	render: vi.fn().mockResolvedValue('<html>mock</html>'),
}));

const queueEvents = new QueueEvents('emails', { connection: redisConnectionOptions });

describe('email worker', () => {
	afterAll(async () => {
		await emailWorker.close();
		await queueEvents.close();
		await emailQueue.obliterate({ force: true });
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

	it('completes a welcome job end to end', async () => {
		const job = await emailQueue.add('welcome', { name: 'Test', email: 'test@example.com' });
		await expect(job.waitUntilFinished(queueEvents)).resolves.not.toThrow();
	});
});
