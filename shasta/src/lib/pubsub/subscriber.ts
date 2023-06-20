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

        const redisSnapshotData = await this.redisClient.hgetall(this.redisSnapshotKey);
        const snapshotSeqNo = await this.redisClient.get(this.redisSnapshotKey);
        if(snapshotSeqNo === null) throw new Error("Snapshot sequence number is null");
        const snapshot = new TagDataSnapshot({ sequenceNumber: snapshotSeqNo });
        for (const [key, value] of Object.entries(redisSnapshotData)) {
            snapshot.snapshot[key] = TagDataEnvelope.fromBinary(Buffer.from(value, 'binary'));
        }
        queue.put({ snapshot });

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

                        lastSeqNo = seqNo;
                    }
                }
            }

            readStreamMessages(lastSeqNo);
        };

        readStreamMessages(snapshotSeqNo || '0-0');

        return queue;
    }
}