import { Cluster } from 'ioredis';
import { env } from "process";
import { slog } from "../logger/slog";

class Flusher {
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

    public async flushAll(): Promise<void> {
        try {
            const nodes = this.redisClient.nodes('master'); // get all master nodes
            const flushPromises = nodes.map(node => node.flushall()); // flush all data from each node
            await Promise.all(flushPromises); // wait for all promises to resolve
            slog.info('Flushed all data from all nodes in the Redis cluster');
        } catch (error) {
            slog.error(`Failed to flush data from Redis cluster: ${error}`);
        }
    }

    // Disconnect from Redis
    public async disconnect(): Promise<void> {
        try {
            this.redisClient.disconnect();
            slog.info("Disconnected from Redis server successfully");
        } catch (error) {
            slog.error('Flusher, Failed to disconnect from Redis server', error);
        }
    }
}

export { Flusher };
