import path from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import type { Application } from 'express';

import expressConfig from './config/expressConfig.js';
import router from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();

app.use('/public', express.static(path.join(__dirname, './public')));

expressConfig(app);

app.use('/api', router);

export default app;
