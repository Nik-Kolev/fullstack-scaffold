import { registerHandler } from '../handlers.js';

registerHandler('presence:ping', (socket) => {
	socket.emit('presence:pong', { userId: socket.data.user.userId });
});
