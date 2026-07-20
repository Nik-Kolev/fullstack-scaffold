import { Job } from 'bullmq';
import prisma from '../lib/prisma.js';
import { createWorker, tokenCleanupQueue } from '../lib/bullmq.js';

const ROTATED_RETENTION_MS = 60 * 60 * 1000;

export async function handleTokenCleanupJob(_job: Job) {
	await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
	await prisma.refreshToken.deleteMany({
		where: { rotatedAt: { lt: new Date(Date.now() - ROTATED_RETENTION_MS) } },
	});
	await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

// Updates the schedule in place if the pattern ever changes, unlike queue.add's repeat option, which would orphan the old one.
// Exported, not run at import: a top-level await would make importing this file (as tests do)
// write a real scheduler into Redis.
export async function registerTokenCleanupSchedule() {
	await tokenCleanupQueue.upsertJobScheduler(
		'deleteExpiredTokens',
		{ pattern: '0 3 * * *' },
		{ name: 'deleteExpiredTokens' },
	);
}

const tokenCleanupWorker = createWorker('tokenCleanup', handleTokenCleanupJob);

export default tokenCleanupWorker;
