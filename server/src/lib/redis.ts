import { Redis } from 'ioredis';

const { hostname: host, port: rawPort } = new URL(process.env.REDIS_URL);

export const redisConnectionOptions = {
	host,
	port: parseInt(rawPort) || 6379,
	maxRetriesPerRequest: null as null,
};

const redis = new Redis(process.env.REDIS_URL);

export default redis;

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

// A bare wildcard here would also match `cache:/api/product/42` — split list vs. single-id invalidation so editing one product doesn't evict every other product's cached detail page.
export async function invalidateListCache(basePath: string) {
	const queryVariants = await scanKeys(`cache:${basePath}\\?*`);
	await redis.del(`cache:${basePath}`, ...queryVariants);
	await redis.set('cache:invalidated-at', Date.now());
}

export async function invalidateDetailCache(path: string) {
	await redis.del(`cache:${path}`);
	await redis.set('cache:invalidated-at', Date.now());
}
