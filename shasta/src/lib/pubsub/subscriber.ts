import { AsyncQueue } from '@esfx/async-queue';
import Redis, { RedisOptions } from 'ioredis';
import { TagData, TagDataSnapshot, TagDataObjectIdentifier, TagDataEnvelope } from '../../../submodules/src/gen/tag_data_pb';

type Message = { snapshot?: TagDataSnapshot; delta?: TagDataEnvelope };

class Subscriber {
    private readonly redisClient: Redis;
    private readonly tagDataObjIdentifier: TagDataObjectIdentifier;
    private readonly redisSnapshotKey: Buffer;

    constructor(redisOptions: RedisOptions, tagDataObjIdentifier: TagDataObjectIdentifier) {
        this.redisClient = new Redis(redisOptions);
        this.tagDataObjIdentifier = tagDataObjIdentifier;
        this.tagDataObjIdentifier.name = "";
        this.redisSnapshotKey = Buffer.from(this.tagDataObjIdentifier.toBinary());

        this.redisClient.on('connect', async () => {
            console.log('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            console.error(`Redis error: ${error}`);
        });
    }

    public async stream(): Promise<AsyncQueue<Message>> {
        const queue = new AsyncQueue<Message>();

        // Get the TagDataSnapshot by iterating hgetall() and the snapshotSeqNo via hget()
        const redisSnapshotData = await this.redisClient.hgetall(this.redisSnapshotKey);
        const snapshotSeqNo = await this.redisClient.get(this.redisSnapshotKey);
        if(snapshotSeqNo === null) throw new Error("Snapshot sequence number is null");
        const snapshot = new TagDataSnapshot({ sequenceNumber: snapshotSeqNo });
        for (const [key, value] of Object.entries(redisSnapshotData)) {
            snapshot.snapshot[key] = TagDataEnvelope.fromBinary(Buffer.from(value, 'binary'));
        }
        queue.put({ snapshot });

        // Set up the xread() loop to get the delta messages
        const readStreamMessages = async (lastSeqNo: string) => {
            const streamMessages = await this.redisClient.xread(
                'COUNT', 100, 'BLOCK', 1000, 'STREAMS', this.redisSnapshotKey, lastSeqNo
            );

            if (streamMessages) {
                for (const [, messages] of streamMessages) {
                    for (const [seqNo, messageData] of messages) {
                        const [, value] = messageData;
                        const delta = TagDataEnvelope.fromBinary(Buffer.from(value, 'binary'));
                        queue.put({ delta });

                        // Update the last sequence number for the next xread() call
                        lastSeqNo = seqNo;
                    }
                }
            }

            // Recursive call to keep reading from the stream
            readStreamMessages(lastSeqNo);
        };

        // Call readStreamMessages with the snapshotSeqNo or '0-0' if it doesn't exist
        readStreamMessages(snapshotSeqNo || '0-0');

        return queue;
    }
}
