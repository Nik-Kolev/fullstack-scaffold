import path from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import type { Application } from 'express';

import expressConfig from './config/expressConfig.js';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import * as paymentController from './controllers/paymentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();

app.use('/public', express.static(path.join(__dirname, './public')));

// Registered ahead of expressConfig deliberately — a container healthcheck
// shouldn't depend on CORS/rate-limiting/helmet being in the picture.
app.get('/health', (_req, res) => {
	res.status(200).json({ status: 'ok' });
});

// Must be registered before expressConfig applies express.json() — Stripe signature
// verification requires the raw request buffer, not a parsed JS object.
app.post(
	'/api/payment/webhook',
	express.raw({ type: 'application/json' }),
	paymentController.handleWebhook,
);

expressConfig(app);

app.use('/api', router);

app.use(errorHandler);

export default app;
