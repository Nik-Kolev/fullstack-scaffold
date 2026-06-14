import { Job } from 'bullmq';
import prisma from '../lib/prisma.js';
import { createWorker, tokenCleanupQueue } from '../lib/bullmq.js';

export async function handleTokenCleanupJob(_job: Job) {
	await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
	await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

await tokenCleanupQueue.add('deleteExpiredTokens', {}, { repeat: { pattern: '0 3 * * *' } });

const tokenCleanupWorker = createWorker('tokenCleanup', handleTokenCleanupJob);

export default tokenCleanupWorker;
