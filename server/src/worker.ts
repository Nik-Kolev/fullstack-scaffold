import prisma from './lib/prisma.js';
import redis from './lib/redis.js';
import * as workers from './workers/index.js';
import { emailQueue, tokenCleanupQueue } from './lib/bullmq.js';
import { registerTokenCleanupSchedule } from './workers/tokenCleanup.worker.js';

const SHUTDOWN_TIMEOUT_MS = 30_000;

let shuttingDown = false;

async function start() {
	await prisma.$connect();
	await registerTokenCleanupSchedule();
	console.log('Worker process started');
}

async function closeEverything() {
	await Promise.all(Object.values(workers).map((w) => w.close()));
	await Promise.all([emailQueue.close(), tokenCleanupQueue.close()]);
	await prisma.$disconnect();
	await redis.quit();
}

async function shutdown() {
	if (shuttingDown) return;
	shuttingDown = true;

	const timeout = new Promise<void>((resolve) => {
		setTimeout(() => {
			console.error(`[worker] shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, exiting`);
			resolve();
		}, SHUTDOWN_TIMEOUT_MS).unref();
	});

	await Promise.race([closeEverything(), timeout]);
	process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
	console.error('[worker] failed to start:', err);
	process.exit(1);
});
