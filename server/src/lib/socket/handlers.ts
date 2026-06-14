import type { Socket } from 'socket.io';

type HandlerFn = (socket: Socket, data: unknown) => void;

type HandlerEntry = {
	event: string;
	fn: HandlerFn;
};

const handlers: HandlerEntry[] = [];

export function registerHandler(event: string, fn: HandlerFn): void {
	handlers.push({ event, fn });
}

export function applyHandlers(socket: Socket): void {
	for (const { event, fn } of handlers) {
		socket.on(event, (data) => fn(socket, data));
	}
}
