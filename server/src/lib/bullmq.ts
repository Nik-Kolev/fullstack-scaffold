import { Queue } from 'bullmq';
import { redisConnectionOptions } from './redis.js';

export const emailQueue = new Queue('emails', { connection: redisConnectionOptions });
