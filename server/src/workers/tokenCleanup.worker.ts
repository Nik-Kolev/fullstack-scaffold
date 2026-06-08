import { Job } from 'bullmq';
import prisma from '../lib/prisma.js';
import { createWorker } from '../lib/bullmq.js';

export async function handleTokenCleanupJob(_job: Job) {
	await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

const tokenCleanupWorker = createWorker('tokenCleanup', handleTokenCleanupJob);

export default tokenCleanupWorker;
