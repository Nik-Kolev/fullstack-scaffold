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
