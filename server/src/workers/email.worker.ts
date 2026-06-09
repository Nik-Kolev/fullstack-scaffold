import { Job } from 'bullmq';
import { createWorker } from '../lib/bullmq.js';
import { WelcomeEmail } from '../emails/welcome.jsx';
import { sendEmail } from '../lib/resend.js';
import { render } from '@react-email/render';

export async function handleEmailJob(job: Job) {
	switch (job.name) {
		case 'welcome': {
			const html = await render(WelcomeEmail({ name: job.data.name, email: job.data.email }));
			await sendEmail({
				to: job.data.email,
				subject: 'Welcome',
				html,
			});
			break;
		}
	}
}

const emailWorker = createWorker('emails', handleEmailJob);

export default emailWorker;
