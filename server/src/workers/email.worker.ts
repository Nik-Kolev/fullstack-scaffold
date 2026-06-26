import { Job } from 'bullmq';
import { createWorker } from '../lib/bullmq.js';
import { WelcomeEmail } from '../emails/welcome.jsx';
import { PasswordReset } from '../emails/passwordReset.js';
import { sendEmail } from '../lib/resend.js';
import { render } from '@react-email/render';
import { PasswordChanged } from '../emails/passwordChanged.js';

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
		case 'password-reset': {
			const resetUrl = `${process.env.ORIGIN}/reset-password?token=${job.data.token}`;
			const html = await render(PasswordReset({ name: job.data.name, resetUrl }));
			await sendEmail({
				to: job.data.email,
				subject: 'Reset your password',
				html,
			});
			break;
		}
		case 'password-changed': {
			const loginUrl = `${process.env.ORIGIN}/login`;
			const html = await render(PasswordChanged({ name: job.data.name, loginUrl }));
			await sendEmail({
				to: job.data.email,
				subject: 'Your password was changed',
				html,
			});
			break;
		}
		default:
			throw new Error(`Unknown email job: ${job.name}`);
	}
}

const emailWorker = createWorker('emails', handleEmailJob);

export default emailWorker;
