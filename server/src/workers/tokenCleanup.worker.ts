import { Job } from 'bullmq';
import prisma from '../lib/prisma.js';
import { createWorker, tokenCleanupQueue } from '../lib/bullmq.js';

export async function handleTokenCleanupJob(_job: Job) {
	await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
	await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

// Updates the schedule in place if the pattern ever changes, unlike queue.add's repeat option, which would orphan the old one.
await tokenCleanupQueue.upsertJobScheduler(
	'deleteExpiredTokens',
	{ pattern: '0 3 * * *' },
	{ name: 'deleteExpiredTokens' },
);

const tokenCleanupWorker = createWorker('tokenCleanup', handleTokenCleanupJob);

export default tokenCleanupWorker;
