import { AsyncQueue } from '@esfx/async-queue';
import Redis, { RedisOptions, Cluster, ClusterNode } from 'ioredis';
import { TagData, TagDataSnapshot, TagDataObjectIdentifier, TagDataEnvelope } from '../../../submodules/src/gen/tag_data_pb';
import {env} from "process";

type Message = { snapshot?: TagDataSnapshot; delta?: TagDataEnvelope };

class Subscriber {
    private readonly redisClient: Cluster;
    private readonly tagDataObjIdentifier: TagDataObjectIdentifier;
    private readonly redisSnapshotKey: string;
    private readonly redisStreamKey: string;

    constructor(tagDataObjIdentifier: TagDataObjectIdentifier) {
        this.redisClient = new Cluster ([ { host: env.REDIS_HOST, port: parseInt(env.REDIS_PORT || "6379") }], { dnsLookup: (address, callback) => callback (null, address), redisOptions: { tls: {}, }, });
        this.tagDataObjIdentifier = tagDataObjIdentifier.clone();
        this.tagDataObjIdentifier.name = "";

        const redisSnapshotKey = Buffer.from(this.tagDataObjIdentifier.toBinary()).toString("base64");
        const commonRedisSnapshotKey = `{${redisSnapshotKey}}:snap:`;
        this.redisSnapshotKey = commonRedisSnapshotKey;
        const commonRedisStreamKey = `{${redisSnapshotKey}}:strm:`;
        this.redisStreamKey = commonRedisStreamKey;

        this.redisClient.on('connect', async () => {
            console.log('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            console.error(`Redis error: ${error}`);
        });
    }

    // Stream messages from Redis
    public async stream(): Promise<AsyncQueue<Message>> {
        const queue = new AsyncQueue<Message>();

        // Get the TagDataSnapshot by iterating hgetall() and the snapshotSeqNo via get()
        const redisSnapshotData = await this.redisClient.hgetall(this.redisSnapshotKey);
        const snapshotSeqNo = redisSnapshotData['seqno'];
        delete redisSnapshotData['seqno'];
        if (snapshotSeqNo === null) {
            throw new Error("Snapshot sequence number is null");
        }
        const snapshot = new TagDataSnapshot({ sequenceNumber: snapshotSeqNo });
        for (const [key, value] of Object.entries(redisSnapshotData)) {
            console.log('subscriber.stream.snapshot: ', {key, value});
            snapshot.snapshot[key] = TagDataEnvelope.fromBinary(Buffer.from(value, "base64"));
        }
        queue.put({ snapshot });

        // Set up the XREAD() loop to get the delta messages
        const readStreamMessages = async (lastSeqNo: string) => {
            const streamMessages = await this.redisClient.xread(
                'COUNT', 100, 'BLOCK', 1000, 'STREAMS', this.redisStreamKey, lastSeqNo
            );

            if (streamMessages) {
                for (const [, messages] of streamMessages) {
                    for (const [seqNo, messageData] of messages) {
                        const [, value] = messageData;
                        const delta = TagDataEnvelope.fromBinary(Buffer.from(value, 'binary'));
                        queue.put({ delta });

                        // Update the last sequence number for the next XREAD() call
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

    // Disconnect from Redis
    public async disconnect(): Promise<void> {
        try {
            await this.redisClient.quit();
            console.log("Disconnected from Redis server successfully");
        } catch (error) {
            console.error('Subscriber, Failed to disconnect from Redis server', error);
        }
    }
}

export { Subscriber };
