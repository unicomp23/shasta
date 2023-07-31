import { Cluster } from 'ioredis';
import { env } from "process";
import { slog } from "../logger/slog";

class RedisKeyCleanup {
    private readonly redisClient: Cluster;

    constructor() {
        this.redisClient = new Cluster([{
            host: env.REDIS_HOST,
            port: parseInt(env.REDIS_PORT || "6379")
        }], {
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: {tls: {},},
        });

        this.redisClient.on('connect', async () => {
            slog.info('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            slog.error(`Redis error: ${error}`);
        });
    }

    public async deleteAllKeys(): Promise<void> {
        let cursor = '0';

        do {
            const res = await this.redisClient.scan(cursor, 'MATCH', '*');
            cursor = res[0];
            const keys = res[1];

            if (keys.length > 0) {
                await this.redisClient.del(...keys);
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

export { RedisKeyCleanup };
