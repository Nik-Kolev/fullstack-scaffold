import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis.js';

export async function handleEmailJob(job: Job) {
	switch (job.name) {
		case 'welcome':
			console.log('Sending welcome email to', job.data.email);
			break;
	}
}

const emailWorker = new Worker('emails', handleEmailJob, {
	connection: redisConnectionOptions,
});

export default emailWorker;
