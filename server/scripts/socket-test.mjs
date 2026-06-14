import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:8080';

// 1. Login to get an access token
const res = await fetch(`${BASE_URL}/api/auth/login`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ email: 'ngkolev93@gmail.com', password: '1234' }),
});
const { accessToken } = await res.json();
console.log('Got token:', accessToken ? 'yes' : 'NO TOKEN - check credentials');

// 2. Connect to Socket.io with the token
const socket = io(BASE_URL, {
	auth: { token: accessToken },
});

socket.on('connect', () => {
	console.log('Connected! socket id:', socket.id);
});

socket.on('user:online', (data) => {
	console.log('user:online event:', data);
});

socket.on('connect_error', (err) => {
	console.error('Connection error:', err.message);
});

socket.on('presence:pong', (data) => {
	console.log('presence:pong received:', data);
});

socket.emit('presence:ping');

// Disconnect after 3 seconds
setTimeout(() => {
	socket.disconnect();
	console.log('Disconnected.');
	process.exit(0);
}, 3000);
