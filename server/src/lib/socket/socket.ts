import { Server } from 'socket.io';
import { verifyToken } from '../jwt.js';
import { joinRooms } from './room.js';
import { applyHandlers } from './handlers.js';
import './index.js';
import type { Server as HttpServer } from 'http';

export let io: Server;

export function initSocket(httpServer: HttpServer): void {
	io = new Server(httpServer, {
		cors: {
			origin: process.env.ORIGIN,
			credentials: true,
		},
	});

	io.use((socket, next) => {
		const token = socket.handshake.auth.token as string | undefined;
		if (!token) return next(new Error('No token'));

		try {
			const payload = verifyToken('access', token);
			socket.data.user = payload;
			next();
		} catch {
			next(new Error('Invalid token'));
		}
	});

	io.on('connection', (socket) => {
		joinRooms(socket);
		applyHandlers(socket);
	});
}
