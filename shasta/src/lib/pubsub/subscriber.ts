import Redis, { RedisOptions } from 'ioredis';
import { TagData, TagDataEnvelope, TagDataSnapshot } from '../../../submodules/src/gen/tag_data_pb';
import { AsyncQueue } from '@esfx/async-queue';

class Subscriber {
    private redisClient: Redis;
    private asyncQueue: AsyncQueue<TagDataEnvelope | TagDataSnapshot>;
    private redisStreamName: string;
    private lastReadId: string;

    constructor(redisOptions: RedisOptions, redisStreamName: string, lastReadId?: string) {
        this.redisClient = new Redis(redisOptions);
        this.asyncQueue = new AsyncQueue<TagDataEnvelope | TagDataSnapshot>();
        this.redisStreamName = redisStreamName;
        this.lastReadId = lastReadId || '0';

        this.redisClient.on('connect', async () => {
            console.log('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            console.error(`Redis error: ${error}`);
        });
    }

    async startSubscription(): Promise<void> {
        // Read initial snapshot from Redis hash
        const initialSnapshot: Record<string, string> = await this.redisClient.hgetall(this.redisStreamName);
        const tagDataSnapshot = new TagDataSnapshot();
        Object.keys(initialSnapshot).forEach((key) => {
            const tagEnvelope = TagDataEnvelope.fromJsonString(initialSnapshot[key]);
            tagDataSnapshot.snapshot[key] = tagEnvelope;
        });
        tagDataSnapshot.sequenceNumber = initialSnapshot['seqno'] || '';
        this.asyncQueue.put(tagDataSnapshot); // Enqueue as TagDataSnapshot

        while (true) {
            const response = await this.redisClient.xread(
                'COUNT',
                10, // read maximum 10 messages per call
                'BLOCK',
                5000, // blocking TIMEOUT in milliseconds
                'STREAMS',
                this.redisStreamName,
                this.lastReadId
            );
            if (response) {
                for (const message of response[0][1]) {
                    const [id, fields] = message;
                    console.log(`Received message ID: ${id}`);
                    console.log('Fields:', fields);

                    const tagData = TagData.fromJsonString(fields[3]);
                    const tagDataEnvelope = new TagDataEnvelope({ tagData, sequenceNumber: id });

                    this.asyncQueue.put(tagDataEnvelope);
                    this.lastReadId = id; // save the ID for the next xread call

                    // Store the sequence number in the Redis hash
                    const redisSnapshotKey: string = this.redisStreamName;
                    await this.redisClient.hset(redisSnapshotKey, 'seqno', id);
                }
            }
        }
    }
}
