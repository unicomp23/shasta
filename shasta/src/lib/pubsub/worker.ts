import {Consumer, EachMessagePayload, Kafka, KafkaMessage} from 'kafkajs';
import {Cluster} from 'ioredis';
import {TagData, TagDataEnvelope, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {env} from "process";
import {slog} from "../logger/slog";
import {Instrumentation} from "./instrument";

class Worker {
    private kafkaConsumer: Consumer;
    private redisClient: Cluster;
    private readonly topic: string;
    private groupJoined_: boolean = false;

    private constructor(kafka: Kafka, groupId: string, topic: string) {
        this.kafkaConsumer = kafka.consumer({
            groupId,
            minBytes: 1,
            maxWaitTimeInMs: 20,
        });
        this.redisClient = new Cluster([{
            host: env.REDIS_HOST,
            port: parseInt(env.REDIS_PORT || "6379")
        }], {
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: {tls: {},},
        });
        this.topic = topic;

        this.redisClient.on('connect', async () => {
            slog.info('Connected to Redis server');
        });

        this.redisClient.on('error', async (error) => {
            slog.error(`Redis error: ${error}`);
        });

        process.on("SIGINT", () => this.shutdown());
        process.on("SIGTERM", () => this.shutdown());
    }

    public static async create(kafka: Kafka, groupId: string, topic: string) {
        const worker = new Worker(kafka, groupId, topic);
        await worker.init();
        return worker;
    }

    public async groupJoined(): Promise<boolean> {
        while (!this.groupJoined_) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    }

    public async shutdown() {
        slog.info("Shutting down the worker gracefully ...");

        try {
            await this.kafkaConsumer.stop();
            await this.kafkaConsumer.disconnect();
            slog.info("Disconnected from Kafka consumer");
        } catch (error) {
            slog.error("Error while disconnecting from Kafka consumer", error);
        }

        try {
            this.redisClient.disconnect();
            slog.info("Disconnected from Redis server");
        } catch (error) {
            slog.error("Error while disconnecting from Redis server", error);
        }
    }

    private async init(): Promise<void> {
        // Connect to Kafka
        try {
            await this.kafkaConsumer.connect();
            slog.info('connected');

            // Kafka disconnection event
            this.kafkaConsumer.on("consumer.crash", async ({type}) => {
                slog.error(`Kafka consumer fatal error: ${type}`);
            });
            this.kafkaConsumer.on("consumer.group_join", async () => {
                slog.info("Kafka consumer group join event");
                this.groupJoined_ = true;
            });
        } catch (error) {
            slog.error(`Error while connecting to Kafka: ${error}`);
            return;
        }

        // Subscribe to the Kafka topic and start consuming
        await this.subscribeToTopic();
    }

    private async subscribeToTopic(): Promise<void> {
        await this.kafkaConsumer.subscribe({
            topic: this.topic,
            fromBeginning: true
        });

        await this.kafkaConsumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                const message: KafkaMessage = payload.message;

                if (message.key && message.value) {
                    try {
                        const tagDataObjIdentifierPartition: TagDataObjectIdentifier = TagDataObjectIdentifier.fromBinary(Buffer.from(message.key));
                        const tagData: TagData = TagData.fromBinary(Buffer.from(message.value));

                        if (tagData.identifier === undefined) {
                            slog.error('invalid tagData: ', {tagData});
                            return;
                        }

                        const redisDeltaKey = tagData.identifier.name;
                        if (redisDeltaKey === undefined || redisDeltaKey === "seqno" || redisDeltaKey === "") {
                            slog.error('invalid tagDataObjIdentifier.name: ', {tagDataObjIdentifier: tagDataObjIdentifierPartition});
                            return;
                        }

                        tagDataObjIdentifierPartition.name = "";
                        Instrumentation.instance.getTimestamps(tagData.identifier!).afterConsume = Date.now();
                        /***
                        const redisSnapshotKey = Buffer.from(tagDataObjIdentifierPartition.toBinary()).toString("base64");

                        const commonRedisSnapshotKey = `{${redisSnapshotKey}}:snap:`;
                        const commonRedisStreamKey = `{${redisSnapshotKey}}:strm:`;

                        try {
                            Instrumentation.instance.getTimestamps(tagData.identifier!).beforeWorkerXAdd = Date.now();
                            const snapshotSeqNo = await this.redisClient.xadd(commonRedisStreamKey, "*", "delta", Buffer.from(tagData.toBinary()).toString("base64"));
                            if (snapshotSeqNo === null) {
                                slog.error(`Missing redis seqno: `, {snapshotSeqNo});
                                return;
                            }
                            Instrumentation.instance.getTimestamps(tagData.identifier!).afterWorkerXAdd = Date.now();
                            const tagDataEnvelope = new TagDataEnvelope({
                                tagData,
                                sequenceNumber: snapshotSeqNo
                            });
                            if (!(snapshotSeqNo && redisDeltaKey)) {
                                slog.error(`Failed to store the snapshot in Redis: `, {
                                    snapshotSeqNo,
                                    redisDeltaKey,
                                    tagData
                                });
                                return;
                            }
                            Instrumentation.instance.getTimestamps(tagData.identifier!).beforeWorkerHSet = Date.now();
                            await this.redisClient.hset(commonRedisSnapshotKey,
                                redisDeltaKey, Buffer.from(tagDataEnvelope.toBinary()).toString("base64"),
                                "seqno", snapshotSeqNo);
                            Instrumentation.instance.getTimestamps(tagData.identifier!).afterWorkerHSet = Date.now();
                        } catch (error) {
                            slog.error('Error during Redis operation:', error);
                        }***/

                        /*slog.info(`Worker: `, {
                            snapshotSeqNo,
                            commonRedisSnapshotKey,
                            commonRedisStreamKey,
                            tagData
                        });*/
                    } catch (e) {
                        slog.error(`Error processing message ${message.key}: ${e}`);
                    }
                } else {
                    slog.error('bad message: ', {message});
                }
            },
        });
    }

}

export {Worker};