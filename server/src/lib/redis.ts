import { Redis } from 'ioredis';

const { hostname: host, port: rawPort } = new URL(process.env.REDIS_URL);

export const redisConnectionOptions = {
	host,
	port: parseInt(rawPort) || 6379,
	maxRetriesPerRequest: null as null,
};

const redis = new Redis(process.env.REDIS_URL);

export default redis;

export async function invalidateCache(pattern: string) {
	const keys = await redis.keys(`cache:${pattern}*`);
	if (keys.length) await redis.del(...keys);
	// Read by redisCache's writeIfStillFresh guard — lets a request that
	// started before this invalidation skip re-caching now-stale data.
	await redis.set('cache:invalidated-at', Date.now());
}

// `invalidateCache('/api/product')` would also match `/api/product/42` via
// its trailing wildcard — these two split "list" (bare path + `?query`
// variants) from "one specific id" (exact key only) so editing one product
// doesn't evict every other product's cached detail page.
export async function invalidateListCache(basePath: string) {
	const queryVariants = await redis.keys(`cache:${basePath}\\?*`);
	await redis.del(`cache:${basePath}`, ...queryVariants);
	await redis.set('cache:invalidated-at', Date.now());
}

export async function invalidateDetailCache(path: string) {
	await redis.del(`cache:${path}`);
	await redis.set('cache:invalidated-at', Date.now());
}
