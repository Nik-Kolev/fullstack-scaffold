import prisma from './lib/prisma.js';
import redis from './lib/redis.js';
import * as workers from './workers/index.js';
import { emailQueue, tokenCleanupQueue } from './lib/bullmq.js';

async function start() {
	await prisma.$connect();
	console.log('Worker process started');
}

async function shutdown() {
	await Promise.all(Object.values(workers).map((w) => w.close()));
	await Promise.all([emailQueue.close(), tokenCleanupQueue.close()]);
	await prisma.$disconnect();
	await redis.quit();
	process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
