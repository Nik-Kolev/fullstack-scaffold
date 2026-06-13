import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './lib/socket.js';

const PORT: number = Number(process.env.PORT);

const server = createServer(app);
initSocket(server);

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
