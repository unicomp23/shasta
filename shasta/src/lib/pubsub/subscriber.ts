import { TagData, TagDataSnapshot, TagDataObjectIdentifier } from '../../../submodules/src/gen/tag_data_pb';
import Redis from 'ioredis';
import { AsyncQueue } from '@esfx/async-queue';

class Subscriber {
    private redisClient: Redis;
    private asyncQueue: AsyncQueue<TagData | TagDataSnapshot>;
    private redisStreamName: string;

    constructor(redisOptions: Redis.RedisOptions, redisStreamName: string) {
        this.redisClient = new Redis(redisOptions);
        this.asyncQueue = new AsyncQueue<TagData | TagDataSnapshot>();
        this.redisStreamName = redisStreamName;

        this.redisClient.on('connect', async () => {
            console.log('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            console.error(`Redis error: ${error}`);
        });
    }

    async startSubscription() {
        let lastReadId = '0'; // start reading the stream from the beginning
        const count = 10; // read maximum 10 messages per call. Adjust based on your needs.

        // Read initial snapshot from redis hash
        const initialSnapshot = await this.redisClient.hgetall(this.redisStreamName);
        const tagDataSnapshot = new TagDataSnapshot();
        for (const key in initialSnapshot) {
            if (key !== 'seqno') {
                const tagObj = TagDataObjectIdentifier.fromBinary(Buffer.from(key));
                tagDataSnapshot.snapshot[tagObj.name] = TagData.fromBinary(Buffer.from(initialSnapshot[key]));
            } else {
                tagDataSnapshot.sequenceNumber = initialSnapshot[key]; // Attach sequence number to the snapshot
            }
        }
        this.asyncQueue.enqueue(tagDataSnapshot);  // Enqueue as TagDataSnapshot

        while (true) { // loop to keep reading from the stream
            const response = await this.redisClient.xread('COUNT', count, 'STREAMS', this.redisStreamName, lastReadId);
            if (response) {
                for (const message of response[0][1]) {
                    const [id, fields] = message;
                    console.log(`Received message ID: ${id}`);
                    console.log('Fields:', fields);

                    const tagData = TagData.fromBinary(Buffer.from(fields[3]));

                    // Enqueue as TagData
                    this.asyncQueue.enqueue(tagData);

                    lastReadId = id; // save the id for the next xread call
                }
            } else {
                // wait some time before next read attempt
                await new Promise(resolve => setTimeout(resolve, 1e3));
            }
        }
    }
}
