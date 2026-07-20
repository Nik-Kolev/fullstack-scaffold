import { Queue, Worker, Job } from 'bullmq';
import { redisConnectionOptions } from './redis.js';

const defaultJobOptions = {
	attempts: 3,
	backoff: { type: 'exponential' as const, delay: 1000 },
	removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
	removeOnFail: { age: 7 * 24 * 60 * 60 },
};

export const createQueue = (name: string) => {
	const queue = new Queue(name, { connection: redisConnectionOptions, defaultJobOptions });

	// Node throws on an unhandled 'error' event, so this listener is what keeps a Redis blip
	// from killing the process.
	queue.on('error', (err) => {
		console.error(`[queue:${name}] error:`, err);
	});

	return queue;
};

export const createWorker = (name: string, processor: (job: Job) => Promise<unknown>) => {
	const worker = new Worker(name, processor, { connection: redisConnectionOptions });

	worker.on('error', (err) => {
		console.error(`[worker:${name}] error:`, err);
	});

	worker.on('failed', (job, err) => {
		console.error(
			`[worker:${name}] job ${job?.id ?? 'unknown'} (${job?.name ?? 'unknown'}) failed on attempt ${job?.attemptsMade ?? 0}:`,
			err,
		);
	});

	return worker;
};

export const emailQueue = createQueue('emails');
export const tokenCleanupQueue = createQueue('tokenCleanup');
