import { Redis } from 'ioredis';
import crypto from 'crypto';

const { hostname: host, port: rawPort } = new URL(process.env.REDIS_URL);

export const redisConnectionOptions = {
	host,
	port: parseInt(rawPort) || 6379,
	maxRetriesPerRequest: null as null,
};

const redis = new Redis(process.env.REDIS_URL);

export default redis;

export const tokensValidAfterKey = (userId: number) => `auth:valid-after:${userId}`;

// Atomic "delete only if the token still matches" — a plain GET+compare+DEL
// isn't atomic and could delete a different holder's lock after our own expired.
const UNLOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("del", KEYS[1])
else
	return 0
end
`;

// One shot — callers needing a retry/poll loop (e.g. redisCache.ts) build it on top of this.
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
	const token = crypto.randomUUID();
	const acquired = await redis.set(key, token, 'PX', ttlMs, 'NX');
	return acquired === 'OK' ? token : null;
}

export async function releaseLock(key: string, token: string): Promise<void> {
	try {
		await redis.eval(UNLOCK_SCRIPT, 1, key, token);
	} catch {
		// Best-effort unlock — if this fails, the lock still expires via its own PX TTL.
	}
}

async function scanKeys(pattern: string): Promise<string[]> {
	const found: string[] = [];
	let cursor = '0';
	do {
		const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
		found.push(...batch);
		cursor = nextCursor;
	} while (cursor !== '0');
	return found;
}

// No TTL, unlike every other key here: it has to outlive any in-flight read, and that
// duration is unbounded. If it expired, a slow read spanning the expiry would repopulate
// the cache with pre-mutation data. See redisCache.ts for the check that reads it.
const markInvalidated = () => redis.set('cache:invalidated-at', Date.now());

// Split from invalidateDetailCache because `cache:/api/product*` would also match
// `cache:/api/product/42` — one edit would evict every product's detail entry.
export async function invalidateListCache(basePath: string) {
	const queryVariants = await scanKeys(`cache:${basePath}\\?*`);
	await redis.del(`cache:${basePath}`, ...queryVariants);
	await markInvalidated();
}

export async function invalidateDetailCache(path: string) {
	await redis.del(`cache:${path}`);
	await markInvalidated();
}
