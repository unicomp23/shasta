import { Kafka, KafkaMessage, EachMessagePayload, Consumer } from 'kafkajs';
import Redis, {ClusterNode, RedisOptions, Cluster} from 'ioredis';
import { TagData, TagDataObjectIdentifier } from "../../../submodules/src/gen/tag_data_pb";
import {env} from "process";

class Worker {
    private kafkaConsumer: Consumer;
    private redisClient: Cluster;
    private readonly topic: string;
    private groupJoined_: boolean = false;

    constructor(kafka: Kafka, groupId: string, topic: string) {
        this.kafkaConsumer = kafka.consumer({ groupId });
        this.redisClient = new Cluster ([ { host: env.REDIS_HOST, port: parseInt(env.REDIS_PORT || "6379") }], { dnsLookup: (address, callback) => callback (null, address), redisOptions: { tls: {}, }, });
        this.topic = topic;

        this.redisClient.on('connect', async () => {
            console.log('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            console.error(`Redis error: ${error}`);
        });

        // Initialize the Kafka consumer and Redis client
        this.init().catch(console.error);

        process.on("SIGINT", () => this.shutdown());
        process.on("SIGTERM", () => this.shutdown());
    }

    private async init(): Promise<void> {
        // Connect to Kafka
        try {
            await this.kafkaConsumer.connect();
            console.log('connected');

            // Kafka disconnection event
            this.kafkaConsumer.on("consumer.crash", async ({ type }) => {
                console.error(`Kafka consumer fatal error: ${type}`);
            });
            this.kafkaConsumer.on("consumer.group_join", async () => {
                console.log("Kafka consumer group join event");
                this.groupJoined_ = true;
            });
        } catch (error) {
            console.error(`Error while connecting to Kafka: ${error}`);
            return;
        }

        // Subscribe to the Kafka topic and start consuming
        await this.subscribeToTopic();
    }

    public async groupJoined(): Promise<boolean> {
        while (!this.groupJoined_) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    }

    private async subscribeToTopic(): Promise<void> {
        await this.kafkaConsumer.subscribe({topic: this.topic, fromBeginning: true});

        await this.kafkaConsumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                const message: KafkaMessage = payload.message;

                if (message.key && message.value) {
                    try {
                        const tagDataObjIdentifier: TagDataObjectIdentifier = TagDataObjectIdentifier.fromBinary(Buffer.from(message.key));

                        const redisDeltaKey = tagDataObjIdentifier.name;
                        if (redisDeltaKey === undefined) {
                            return;
                        }
                        tagDataObjIdentifier.name = "";
                        const redisSnapshotKey = Buffer.from(tagDataObjIdentifier.toBinary());

                        const tagData: TagData = TagData.fromBinary(Buffer.from(message.value));

                        const luaScript = `
local snapshotXAddKey = ARGV[1]
local snapshotData = ARGV[2]
local deltaHSetKey = ARGV[3]
local deltaKey = ARGV[4]
local deltaData = ARGV[5]
local snapshotSeqNo = redis.call("XADD", snapshotXAddKey, "*", "f", snapshotData)
redis.call("HSET", deltaHSetKey, deltaKey, deltaData)
redis.call("SET", snapshotXAddKey, snapshotSeqNo)
return snapshotSeqNo
`;

                        if (redisSnapshotKey && redisDeltaKey && tagData) {
                            const hashTag = tagData.identifier?.appId;
                            if(hashTag) {
                                const commonRedisSnapshotKey = `{${hashTag}}:${redisSnapshotKey}`;
                                const commonDeltaHSetKey = `{${hashTag}}:hset:${redisDeltaKey}}`;

                                const snapshotSeqNo = await this.redisClient.eval(
                                    luaScript, 0,
                                    commonRedisSnapshotKey, Buffer.from(tagData.toBinary()),
                                    commonDeltaHSetKey, redisDeltaKey, Buffer.from(tagData.toBinary())
                                );

                                console.log(`Snapshot sequence number: `, {snapshotSeqNo, commonRedisSnapshotKey, commonDeltaHSetKey });
                            } else {
                                console.error(`missing appId: `, tagData);
                            }
                        } else {
                            console.error("Error: One or more required values are undefined or null");
                        }
                    } catch (e) {
                        console.error(`Error processing message ${message.key}: ${e}`);
                    }
                }
            },
        });
    }

    public async shutdown() {
        console.log("Shutting down the worker gracefully");

        try {
            await this.kafkaConsumer.stop();
            await this.kafkaConsumer.disconnect();
            console.log("Disconnected from Kafka consumer");
        } catch (error) {
            console.error("Error while disconnecting from Kafka consumer", error);
        }

        try {
            await this.redisClient.quit();
            console.log("Disconnected from Redis server");
        } catch (error) {
            console.error("Error while disconnecting from Redis server", error);
        }
    }

}

export { Worker };
