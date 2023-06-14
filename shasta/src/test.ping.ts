// Import ioredis module
import Redis from 'ioredis';

async function connectToRedis() {
    // Create ioredis client instance with connection settings
    const redis = new Redis({
        host: 'clustercfg.shasta-redis-automation788.3ezarj.memorydb.us-east-1.amazonaws.com',
        port: 6379,
        tls: {}, // Empty object to enable TLS
        retryStrategy: (times: number) => Math.max(times * 100, 3000), // Optional: retry strategy
    });

    try {
        // If connection is successful, send a PING command
        const pingResponse = await redis.ping();
        console.log('PING response:', pingResponse);
    } catch (error) {
        console.error('Error connecting to Redis:', error);
    } finally {
        // Close the Redis connection
        await redis.quit();
    }
}

connectToRedis();
