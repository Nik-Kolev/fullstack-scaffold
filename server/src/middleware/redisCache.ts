import type { Request, Response, NextFunction } from 'express';
import redis from '../lib/redis.js';

export function redisCache(ttlMinutes: number) {
	return async (req: Request, res: Response, next: NextFunction) => {
		if (req.method !== 'GET') return next();

		const key = `cache:${req.originalUrl}`;
		const cached = await redis.get(key);

		if (cached) {
			return res.json(JSON.parse(cached));
		}

		const originalJson = res.json.bind(res);
		res.json = (body) => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				redis.setex(key, ttlMinutes * 60, JSON.stringify(body));
			}
			return originalJson(body);
		};

		next();
	};
}

export async function invalidateCache(pattern: string) {
	const keys = await redis.keys(`cache:${pattern}*`);
	if (keys.length) await redis.del(...keys);
}
