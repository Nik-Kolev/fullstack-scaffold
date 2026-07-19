import type { Request, Response, NextFunction } from 'express';
import redis, { acquireLock, releaseLock } from '../lib/redis.js';

const LOCK_TTL_MS = 5000;
const POLL_INTERVAL_MS = 50;
// Must stay >= LOCK_TTL_MS, else losers fall through to an unprotected DB hit while the lock is still valid.
const POLL_CEILING_MS = LOCK_TTL_MS + POLL_INTERVAL_MS;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Skips the write if a mutation invalidated the cache after this request
// started — otherwise a slow read racing a concurrent write could
// re-populate the cache with data from before the mutation. Never rejects —
// a failed write is just a cache miss for the next request, not a problem
// for this one — so callers can chain off it without a separate catch.
async function writeIfStillFresh(
	key: string,
	ttlSeconds: number,
	body: unknown,
	requestStartedAt: number,
) {
	try {
		const invalidatedAt = await redis.get('cache:invalidated-at');
		if (invalidatedAt && Number(invalidatedAt) > requestStartedAt) return;
		await redis.setex(key, ttlSeconds, JSON.stringify(body));
	} catch {
		// intentionally empty — see doc comment above.
	}
}

export function redisCache(ttlSeconds: number) {
	return async (req: Request, res: Response, next: NextFunction) => {
		if (req.method !== 'GET') return next();

		const requestStartedAt = Date.now();
		const key = `cache:${req.originalUrl}`;
		const cached = await redis.get(key);
		if (cached) {
			return res.json(JSON.parse(cached));
		}

		const lockKey = `lock:${key}`;

		function becomeWinner(token: string) {
			let released = false;
			const release = () => {
				if (released) return;
				released = true;
				void releaseLock(lockKey, token);
			};
			res.once('finish', release);
			res.once('close', release);

			const originalJson = res.json.bind(res);
			res.json = (body) => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					// Wait for the cache write before actually sending the response —
					// 'finish' (and so lock release) then can't fire until the write
					// has settled, closing the "poller wins the retry while our
					// write is still in flight" gap with no separate synchronization.
					void writeIfStillFresh(key, ttlSeconds, body, requestStartedAt).then(() =>
						originalJson(body),
					);
					return res;
				}
				return originalJson(body);
			};

			return next();
		}

		const token = await acquireLock(lockKey, LOCK_TTL_MS);
		if (token) {
			return becomeWinner(token);
		}

		// Lost the race — poll the cache, and re-attempt the lock in case the
		// current holder disappeared early (errored, didn't just take a while)
		// rather than its full TTL lapsing. Bounds a winner failure to one
		// retry instead of every loser falling through to an unprotected DB hit.
		const deadline = Date.now() + POLL_CEILING_MS;
		while (Date.now() < deadline) {
			await sleep(POLL_INTERVAL_MS);
			const cachedNow = await redis.get(key);
			if (cachedNow) {
				return res.json(JSON.parse(cachedNow));
			}

			const retryToken = await acquireLock(lockKey, LOCK_TTL_MS);
			if (retryToken) {
				return becomeWinner(retryToken);
			}
		}

		// Ceiling hit — the winner (or a retry winner) is still working, or
		// every retry lost the race too. Documented trade-off: fall through to
		// an unprotected fetch rather than block indefinitely.
		return next();
	};
}
