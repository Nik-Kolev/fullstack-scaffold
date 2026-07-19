import type { Request, Response } from 'express';
import * as authService from '../services/authServices.js';
import * as JWT from '../lib/jwt.js';
import CustomError from '../utils/customError.js';

export const createUser = async (req: Request, res: Response) => {
	const { email, name, password } = req.body;
	const { user, accessToken, refreshToken } = await authService.createUser({
		email,
		name,
		password,
	});

	res.cookie('refreshToken', refreshToken.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: refreshToken.expiryDate.getTime() - Date.now(),
	});
	res.status(201).json({ user, accessToken });
};

export const loginUser = async (req: Request, res: Response) => {
	const { email, password } = req.body;
	const { user, accessToken, refreshToken } = await authService.loginUser(email, password);

	res.cookie('refreshToken', refreshToken.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: refreshToken.expiryDate.getTime() - Date.now(),
	});
	res.status(200).json({ user, accessToken });
};

export const logoutUser = async (req: Request, res: Response) => {
	const cookie = req.cookies.refreshToken;

	if (cookie) {
		try {
			const token = JWT.verifyToken('refresh', cookie);
			await authService.logoutUser(token.refreshTokenId!);
		} catch {
			// invalid/expired refresh token - nothing to delete, still clear the cookie below
		}
	}

	const authHeader = req.headers.authorization;
	const accessToken = authHeader?.split(' ')[1];

	if (accessToken) {
		try {
			const payload = JWT.verifyToken('access', accessToken);
			await authService.blacklistToken(payload.jti!, payload.exp!);
		} catch {
			// token is expired - nothing to blacklist
		}
	}

	res.clearCookie('refreshToken');
	res.sendStatus(204);
};

export const refreshToken = async (req: Request, res: Response) => {
	const cookie = req.cookies.refreshToken;

	if (!cookie) {
		res.clearCookie('refreshToken');
		throw new CustomError(401, 'No refresh token provided.');
	}

	try {
		const token = JWT.verifyToken('refresh', cookie);

		const { accessToken, refreshToken } = await authService.refreshToken(
			token.refreshTokenId!,
			token.userId as number,
		);

		res.cookie('refreshToken', refreshToken.token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			maxAge: refreshToken.expiryDate.getTime() - Date.now(),
		});
		res.status(200).json({ accessToken });
	} catch (err) {
		res.clearCookie('refreshToken');
		throw err;
	}
};

export const googleRedirect = (req: Request, res: Response) => {
	const url = authService.getGoogleAuthUrl();
	res.redirect(url);
};

export const googleCallback = async (req: Request, res: Response) => {
	const code = req.query.code as string;

	try {
		const { oauthCode } = await authService.handleGoogleCallback(code);
		res.redirect(`${process.env.ORIGIN}/auth/callback?code=${oauthCode}`);
	} catch {
		// This leg must always redirect back into the popup, success or failure —
		// GoogleCallbackPage.tsx is the only place that can postMessage to window.opener,
		// so letting an error reach errorHandler here would dead-end as raw JSON in the popup.
		res.redirect(`${process.env.ORIGIN}/auth/callback?error=1`);
	}
};

export const exchangeGoogleCode = async (req: Request, res: Response) => {
	const { code } = req.body;
	const { accessToken, user, refreshToken } = await authService.exchangeGoogleCode(code);

	res.cookie('refreshToken', refreshToken.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: new Date(refreshToken.expiryDate).getTime() - Date.now(),
	});

	res.status(200).json({ accessToken, user });
};

export const changePassword = async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const { currentPassword, newPassword } = req.body;

	const { user, accessToken, refreshToken } = await authService.changePassword(
		userId,
		currentPassword,
		newPassword,
	);

	try {
		await authService.blacklistToken(req.user!.jti, req.user!.exp);
	} catch (_) {
		// Redis failure — old token expires naturally within 15 min
	}

	res.cookie('refreshToken', refreshToken.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: refreshToken.expiryDate.getTime() - Date.now(),
	});

	res.status(200).json({ user, accessToken, message: 'Password changed successfully.' });
};

export const forgotPassword = async (req: Request, res: Response) => {
	const email = req.body.email;

	await authService.forgotPassword(email);

	res.status(200).json({
		message: 'If an account with that email exists, a password reset link has been send.',
	});
};

export const resetPassword = async (req: Request, res: Response) => {
	const { token, newPassword } = req.body;

	const { user, accessToken, refreshToken } = await authService.resetPassword(token, newPassword);

	res.cookie('refreshToken', refreshToken.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: refreshToken.expiryDate.getTime() - Date.now(),
	});

	res.status(200).json({ user, accessToken, message: 'Password changed successfully.' });
};
