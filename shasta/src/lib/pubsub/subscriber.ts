import Redis, {RedisOptions} from 'ioredis';
import { TagData, TagDataObjectIdentifier, TagDataEnvelope, TagDataSnapshot } from '../../../submodules/src/gen/tag_data_pb';
import { AsyncQueue } from '@esfx/async-queue';

class Subscriber {
    private redisClient: Redis;
    private asyncQueue: AsyncQueue<TagDataEnvelope | TagDataSnapshot>;
    private redisStreamName: string;

    constructor(redisOptions: RedisOptions, redisStreamName: string) {
        this.redisClient = new Redis(redisOptions);
        this.asyncQueue = new AsyncQueue<TagDataEnvelope | TagDataSnapshot>();
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
        const count = 10; // read maximum 10 messages per call.
        const blockTime = 5000; // blocking TIMEOUT in milliseconds.

        // Read initial snapshot from redis hash
        const initialSnapshot = await this.redisClient.hgetall(this.redisStreamName);
        const tagDataSnapshot = new TagDataSnapshot();
        Object.keys(initialSnapshot).forEach((key) => {
            if (key !== 'seqno') {
                const tagObj = TagDataObjectIdentifier.fromJsonString(key);
                const tagEnvelope = TagDataEnvelope.fromJsonString(initialSnapshot[key]);
                if(tagObj.name === undefined) return; // todo: handle this error
                tagDataSnapshot.snapshot = { ...tagDataSnapshot.snapshot, [tagObj.name]: tagEnvelope };
            } else {
                tagDataSnapshot.sequenceNumber = initialSnapshot[key];
            }
        });
        this.asyncQueue.put(tagDataSnapshot);  // Enqueue as TagDataSnapshot

        while (true) {
            const response = await this.redisClient.xread('COUNT', count, 'BLOCK', blockTime, 'STREAMS', this.redisStreamName, lastReadId);
            if (response) {
                for (const message of response[0][1]) {
                    const [id, fields] = message;
                    console.log(`Received message ID: ${id}`);
                    console.log('Fields:', fields);

                    const tagData = TagData.fromJsonString(fields[3]);
                    const tagDataEnvelope = new TagDataEnvelope({ tagData, sequenceNumber: id });

                    this.asyncQueue.put(tagDataEnvelope);

                    lastReadId = id; // save the id for the next xread call
                }
            }
        }
    }
}