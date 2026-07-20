import type { Response } from 'express';

export const OAUTH_STATE_COOKIE = 'oauthState';

const isProduction = () => process.env.NODE_ENV === 'production';

export const setRefreshCookie = (res: Response, token: string, expiryDate: Date) => {
	res.cookie('refreshToken', token, {
		httpOnly: true,
		secure: isProduction(),
		sameSite: 'strict',
		maxAge: expiryDate.getTime() - Date.now(),
	});
};

// 'lax', not 'strict': the callback is a cross-site top-level navigation, and browsers do
// not attach a strict cookie to one — it would be absent on every callback.
export const setOAuthStateCookie = (res: Response, state: string) => {
	res.cookie(OAUTH_STATE_COOKIE, state, {
		httpOnly: true,
		secure: isProduction(),
		sameSite: 'lax',
		maxAge: 10 * 60 * 1000,
	});
};
