import { Kafka, KafkaMessage, EachMessagePayload, Consumer } from 'kafkajs';
import Redis, { RedisOptions } from 'ioredis';
import { TagData, TagDataObjectIdentifier } from "../../../submodules/src/gen/tag_data_pb";

class Worker {
    private kafkaConsumer: Consumer;
    private redisClient: Redis;

    constructor(kafka: Kafka, groupId: string, topic: string, redisOptions: RedisOptions) {
        this.kafkaConsumer = kafka.consumer({ groupId });
        this.redisClient = new Redis(redisOptions);

        // Initialize the Kafka consumer and Redis client
        this.init(topic).catch(console.error);
    }

    private async init(topic: string): Promise<void> {
        // Connect to Kafka
        await this.kafkaConsumer.connect();

        // Subscribe to a Kafka topic
        await this.kafkaConsumer.subscribe({ topic, fromBeginning: true });

        await this.kafkaConsumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                const message: KafkaMessage = payload.message;

                if(message.key && message.value) {
                    // Decode the incoming key as a TagDataObjectIdentifier
                    const tagDataObjIdentifier: TagDataObjectIdentifier = TagDataObjectIdentifier.fromBinary(Buffer.from(message.key));
                    tagDataObjIdentifier.name = ""; // Clear out the 'name' field
                    const redisSnapshotKey = Buffer.from(tagDataObjIdentifier.toBinary());

                    // Decode the incoming value as a TagData
                    const tagData: TagData = TagData.fromBinary(Buffer.from(message.value));
                    const redisDeltaKey = message.key;

                    // Add the tag data to the Redis stream and get the returned ID (sequence number of the snapshot)
                    const snapshotSeqNo = await this.redisClient.xadd(redisSnapshotKey, "*", redisDeltaKey, Buffer.from(tagData.toBinary()));

                    // Save the delta (TagData) in the Redis hash identified by the snapshotKey
                    await this.redisClient.hset(redisSnapshotKey.toString(), redisDeltaKey, tagData.data as string);

                    // Save the sequence number of the snapshot to Redis
                    if (snapshotSeqNo !== null){
                        await this.redisClient.set(redisSnapshotKey.toString(), snapshotSeqNo);
                    }
                }
            }
        });
    }
}