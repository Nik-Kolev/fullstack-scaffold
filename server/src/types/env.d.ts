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
	}
}
