import { Resend, type CreateEmailOptions } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(params: Omit<CreateEmailOptions, 'from'>) {
	return resend.emails.send({
		from: process.env.RESEND_FROM!,
		...(process.env.RESEND_REPLY_TO && { replyTo: process.env.RESEND_REPLY_TO }),
		...params,
	} as CreateEmailOptions);
}

export default resend;
