import * as Redis from 'ioredis';

async function readFromStream() {
    const redis = new Redis.Cluster([{
        host: process.env.MEMORY_DB_ENDPOINT_ADDRESS,
        port: parseInt(process.env.REDIS_PORT || "6379")
    }], {
        dnsLookup: (address, callback) => callback(null, address),
        redisOptions: {
            tls: {},
        },
    });

    try {
        console.log('About to xread');
        const streamName = process.env.MULTICAST_STREAM_NAME;
        if (!streamName) {
            throw new Error('MULTICAST_STREAM_NAME is not defined in the environment variables');
        }
        const result = await redis.xread('COUNT', 1, 'STREAMS', streamName, '$');
        console.log('Finished xread', result);
    } catch (error) {
        console.error('Error during xread operation:', error);
    }

    try {
        console.log('About to quit');
        await redis.quit();
        console.log('Finished quit');
    } catch (error) {
        console.error('Error during quit operation:', error);
    }
}

readFromStream();
