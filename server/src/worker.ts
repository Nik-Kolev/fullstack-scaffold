import { tokenCleanupQueue } from './lib/bullmq.js';
import prisma from './lib/prisma.js';
import * as workers from './workers/index.js';

async function start() {
	await prisma.$connect();
	await tokenCleanupQueue.add(
		'deleteExpiredTokens',
		{},
		{
			repeat: { pattern: '0 3 * * *' },
		},
	);
	console.log('Worker process started');
}

async function shutdown() {
	await Promise.all(Object.values(workers).map((w) => w.close()));
	await prisma.$disconnect();
	process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
