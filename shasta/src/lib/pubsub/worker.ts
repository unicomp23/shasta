import { Kafka, EachMessagePayload } from 'kafkajs';
import Redis, { RedisOptions } from 'ioredis';
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";

class Worker {
    private consumer: any;
    private redis: Redis;

    constructor(kafka: Kafka, groupId: string, topic: string, redisOptions: RedisOptions) {
        this.consumer = kafka.consumer({ groupId });
        this.redis = new Redis(redisOptions);
        this.init(topic).catch(console.error);
    }

    private async init(topic: string): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topic, fromBeginning: true });

        await this.consumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                if(payload.message.key && payload.message.value) {
                    const tagDataObjectIdentifier: TagDataObjectIdentifier = TagDataObjectIdentifier.fromBinary(Buffer.from(payload.message.key));
                    tagDataObjectIdentifier.name = "";
                    const snapshotKey = Buffer.from(tagDataObjectIdentifier.toBinary());

                    const tagData: TagData = TagData.fromBinary(Buffer.from(payload.message.value));
                    const deltaKey = payload.message.key;

                    // Adding to Redis Stream and saving returned ID from XADD operation
                    const returnedId = await this.redis.xadd(snapshotKey, "*", Buffer.from(tagData.toBinary()));

                    await this.redis.hset(snapshotKey, deltaKey, Buffer.from(tagData.toBinary()));

                    // Store returned ID from XADD operation (ie seqno of snapshot)
                    if (returnedId !== null)
                        await this.redis.set(snapshotKey, returnedId);
                }
            },
        });
    }
}
