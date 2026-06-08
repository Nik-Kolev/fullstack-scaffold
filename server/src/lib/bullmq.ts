import { Queue, Worker, Job } from 'bullmq';
import { redisConnectionOptions } from './redis.js';

export const createQueue = (name: string) => {
	return new Queue(name, { connection: redisConnectionOptions });
};

export const createWorker = (name: string, processor: (job: Job) => Promise<unknown>) => {
	return new Worker(name, processor, { connection: redisConnectionOptions });
};

export const emailQueue = createQueue('emails');
export const tokenCleanupQueue = createQueue('tokenCleanup');
