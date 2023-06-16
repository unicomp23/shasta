import { Kafka, KafkaMessage, EachMessagePayload, Consumer } from 'kafkajs';
import Redis, { RedisOptions } from 'ioredis';
import { TagData, TagDataObjectIdentifier } from "../../../submodules/src/gen/tag_data_pb";

class Worker {
    private kafkaConsumer: Consumer;
    private redisClient: Redis;
    private readonly topic: string;

    constructor(kafka: Kafka, groupId: string, topic: string, redisOptions: RedisOptions) {
        this.kafkaConsumer = kafka.consumer({ groupId });
        this.redisClient = new Redis(redisOptions);
        this.topic = topic;

        this.redisClient.on('connect', async () => {
            console.log('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            console.error(`Redis error: ${error}`);
        });

        // Initialize the Kafka consumer and Redis client
        this.init().catch(console.error);
    }

    private async init(): Promise<void> {
        // Connect to Kafka
        try {
            await this.kafkaConsumer.connect();

            // Kafka disconnection event
            this.kafkaConsumer.on("consumer.crash", async ({ type }) => {
                console.error(`Kafka consumer fatal error: ${type}`);

                // Reconnect logic.
                setTimeout(() => {
                    this.init().catch(console.error);
                }, 10000); // Reconnect after 10s
            });
        } catch (error) {
            console.error(`Error while connecting to Kafka: ${error}`);

            // Retry connection after 10 seconds
            setTimeout(() => {
                this.init().catch(console.error);
            }, 10000);
            return;
        }

        // Subscribe to the Kafka topic and start consuming
        await this.subscribeToTopic();
    }

    private async subscribeToTopic(): Promise<void> {
        await this.kafkaConsumer.subscribe({ topic: this.topic, fromBeginning: true });

        await this.kafkaConsumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                const message: KafkaMessage = payload.message;

                if (message.key && message.value) {
                    try {
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
                    } catch (e) {
                        console.error(`Error processing message ${message.key}: ${e}`);
                    }
                }
            },
        });
    }
}