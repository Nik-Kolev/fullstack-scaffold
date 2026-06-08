import { Job } from 'bullmq';
import { createWorker } from '../lib/bullmq.js';

export async function handleEmailJob(job: Job) {
	switch (job.name) {
		case 'welcome':
			console.log('Sending welcome email to', job.data.email);
			break;
	}
}

const emailWorker = createWorker('emails', handleEmailJob);

export default emailWorker;
