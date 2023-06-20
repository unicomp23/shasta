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

        this.init().catch(console.error);

        process.on("SIGINT", () => this.shutdown());
        process.on("SIGTERM", () => this.shutdown());
    }

    private async init(): Promise<void> {
        try {
            await this.kafkaConsumer.connect();
            this.kafkaConsumer.on("consumer.crash", async ({ type }) => {
                console.error(`Kafka consumer fatal error: ${type}`);
                setTimeout(() => {
                    this.init().catch(console.error);
                }, 10000);
            });
        } catch (error) {
            console.error(`Error while connecting to Kafka: ${error}`);

            setTimeout(() => {
                this.init().catch(console.error);
            }, 10000);
            return;
        }

        await this.subscribeToTopic();
    }

    private async subscribeToTopic(): Promise<void> {
        await this.kafkaConsumer.subscribe({ topic: this.topic, fromBeginning: true });

        await this.kafkaConsumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                const message: KafkaMessage = payload.message;

                if (message.key && message.value) {
                    try {
                        const tagDataObjIdentifier: TagDataObjectIdentifier = TagDataObjectIdentifier.fromBinary(Buffer.from(message.key));
                        const redisDeltaKey = tagDataObjIdentifier.name;
                        if(redisDeltaKey === undefined) return; // todo
                        tagDataObjIdentifier.name = "";
                        const redisSnapshotKey = Buffer.from(tagDataObjIdentifier.toBinary());

                        const tagData: TagData = TagData.fromBinary(Buffer.from(message.value));

                        const luaScript = `
                          local snapshotKey = ARGV[1]
                          local snapshotData = ARGV[2]
                          local deltaKey = ARGV[3]
                          local deltaData = ARGV[4]
                          local snapshotSeqNo = redis.call("XADD", snapshotKey, "*", snapshotData)
                          redis.call("HSET", snapshotKey, deltaKey, deltaData)
                          redis.call("SET", snapshotKey, snapshotSeqNo)
                          return snapshotSeqNo
                        `;

                        const snapshotSeqNo = await this.redisClient.eval(luaScript, 0, redisSnapshotKey,
                            Buffer.from(tagData.toBinary()),redisDeltaKey,Buffer.from(tagData.toBinary()));

                    } catch (e) {
                        console.error(`Error processing message ${message.key}: ${e}`);
                    }
                }
            },
        });
    }

    private async shutdown() {
        console.log("Shutting down Worker gracefully");

        try {
            await this.kafkaConsumer.disconnect();
            console.log("Kafka consumer disconnected");
        } catch (error) {
            console.error("Error while disconnecting Kafka consumer", error);
        }

        try {
            await this.redisClient.quit();
            console.log("Redis client disconnected");
        } catch (error) {
            console.error("Error while disconnecting Redis client", error);
        }

        process.exit(0);
    }

}