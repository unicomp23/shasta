import {Cluster} from 'ioredis';
import {env} from "process";
import {slog} from "../logger/slog";

class RedisKeyCleanup {
    private readonly redisClient: Cluster;

    private constructor(redisClient: Cluster) {
        this.redisClient = redisClient;
    }

    public static async create(): Promise<RedisKeyCleanup> {
        if (env.MEMORY_DB_ENDPOINT_ADDRESS && env.MEMORY_DB_ENDPOINT_ADDRESS.length > 0)
            env.REDIS_HOST = env.MEMORY_DB_ENDPOINT_ADDRESS;

        slog.info(`Redis host: ${env.REDIS_HOST}`);
        slog.info(`Redis port: ${env.REDIS_PORT || "6379"}`);
        const redisClient = new Cluster([{
            host: env.REDIS_HOST,
            port: parseInt(env.REDIS_PORT || "6379")
        }], {
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: {tls: {},},
        });

        return new Promise((resolve, reject) => {
            redisClient.on('connect', () => {
                slog.info('Connected to Redis server');
                resolve(new RedisKeyCleanup(redisClient));
            });

            redisClient.on('error', (error) => {
                slog.error(`Redis error: ${error}`);
                reject(error);
            });
        });
    }

    public async deleteAllKeys(): Promise<void> {
        slog.info("Starting to delete all keys from Redis server");
        let cursor = '0';

        do {
            const res = await this.redisClient.scan(cursor, 'MATCH', '*');
            cursor = res[0];
            const keys = res[1];

            if (keys.length > 0) {
                // Delete keys sequentially
                for (const key of keys) {
                    await this.redisClient.del(key);
                }
            }
        } while (cursor !== '0');

        slog.info("Deleted all keys from Redis server");
    }

    public async disconnect(): Promise<void> {
        try {
            this.redisClient.disconnect();
            slog.info("Disconnected from Redis server successfully");
        } catch (error) {
            slog.error('Failed to disconnect from Redis server', error);
        }
    }
}

export {RedisKeyCleanup};
