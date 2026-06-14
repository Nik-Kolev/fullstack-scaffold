import type { Socket } from 'socket.io';
import type { JwtPayload } from 'jsonwebtoken';

type RoomRule = {
	room: string | ((user: JwtPayload) => string);
	when?: (user: JwtPayload) => boolean;
};

const roomRules: RoomRule[] = [
	{ room: (user) => `user:${user.userId}` },
	// { room: 'role:admin', when: (user) => user.role === 'admin' },
];

export function joinRooms(socket: Socket): void {
	const user = socket.data.user as JwtPayload;
	for (const rule of roomRules) {
		if (!rule.when || rule.when(user)) {
			const roomName = typeof rule.room === 'function' ? rule.room(user) : rule.room;
			socket.join(roomName);
		}
	}
}
