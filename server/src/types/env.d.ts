import type { string } from 'zod';

declare namespace NodeJS {
	interface ProcessEnv {
		PORT: string;
		ORIGIN: string;
		DATABASE_URL: string;
		JWT_ACCESS_SECRET: string;
		JWT_REFRESH_SECRET: string;
		NODE_ENV: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
		GOOGLE_REDIRECT_URI: string;
		REDIS_URL: string;
		RESEND_API_KEY: string;
		RESEND_FROM: string;
		RESEND_REPLY_TO: string;
		R2_PUBLIC_URL: string;
		R2_ACCESS_KEY_ID: string;
		R2_SECRET_ACCESS_KEY: string;
		R2_BUCKET_NAME: string;
		R2_ACCOUNT_ID: string;
		R2_ENDPOINT: string;
	}
}
