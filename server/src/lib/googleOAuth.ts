import { google } from 'googleapis';

export const createOAuthClient = () =>
	new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.GOOGLE_REDIRECT_URI,
	);

export default createOAuthClient();
