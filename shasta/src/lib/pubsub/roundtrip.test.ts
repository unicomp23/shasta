import { ITopicConfig } from "kafkajs";
import Redis, { Cluster, ClusterNode, RedisOptions } from "ioredis";
import { TagData, TagDataObjectIdentifier } from "../../../submodules/src/gen/tag_data_pb";
import { Publisher } from "./publisher";
import { Subscriber } from "./subscriber";
import { Worker } from "./worker";
import { createKafka } from "../kafka/createKafka";
import crypto from "crypto";
import { Deferred, delay } from "@esfx/async";
import { env } from "process";

const REDIS_OPTIONS: RedisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    tls: {},
};

// Kafka topic for testing
const kafkaTopic = `test_topic-${crypto.randomUUID()}`;

async function waitFor(durationInMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

async function setup() {
    const identifier = new TagDataObjectIdentifier();
    identifier.appId = `some-app-id-${crypto.randomUUID()}`;
    identifier.tag = `tag-id-${crypto.randomUUID()}`;
    identifier.scope = `scope-id-${crypto.randomUUID()}`;
    identifier.name = `name-${crypto.randomUUID()}`;

    const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);
    const admin = kafka.admin();
    await admin.connect();
    const topicConfig: ITopicConfig = {
        topic: kafkaTopic,
    };
    await admin.createTopics({
        topics: [topicConfig],
    });
    await admin.disconnect();

    const publisher = new Publisher(kafka, kafkaTopic);
    await publisher.connect();

    const redisClient = new Cluster([{ host: env.REDIS_HOST, port: parseInt(env.REDIS_PORT || "6379") }], { dnsLookup: (address, callback) => callback(null, address), redisOptions: { tls: {}, }, });

    const subscriber = new Subscriber(identifier);

    const groupId = `test-group-id-${crypto.randomUUID()}`;
    const worker = new Worker(kafka, groupId, kafkaTopic);
    await worker.groupJoined();

    return { publisher, subscriber, worker, redisClient, identifier };
}

async function teardown(publisher: Publisher, subscriber: Subscriber, worker: Worker, redisClient: Cluster) {
    await worker.shutdown();
    await publisher.disconnect();
    await redisClient.quit();
    await subscriber.disconnect();
}

describe("End-to-End Test 2", () => {
    let publisher: Publisher;
    let subscriber: Subscriber;
    let worker: Worker;
    let redisClient: Cluster;
    let identifier: TagDataObjectIdentifier;

    beforeAll(async () => {
        const resources = await setup();
        publisher = resources.publisher;
        subscriber = resources.subscriber;
        worker = resources.worker;
        redisClient = resources.redisClient;
        identifier = resources.identifier;
    });

    afterAll(async () => {
        await teardown(publisher, subscriber, worker, redisClient);
    });

    it("should process messages from Publisher to Worker via Redis Subscriber", async () => {
        const tagData = new TagData();
        tagData.identifier = identifier.clone();
        tagData.data = "Test Value";

        // Send TagData message from Publisher
        await publisher.send(tagData);

        // Wait for the message to reach Redis Subscriber through Worker
        await waitFor(2000);

        const redisSnapshotKey = getRedisSnapshotKey(identifier);
        const redisSnapshotData = await redisClient.hgetall(redisSnapshotKey);

        // Retrieve snapshots from Subscriber
        const snapshotsQueue = await subscriber.stream();

        // Dequeue snapshots until the queue is empty
        const message = await snapshotsQueue.get();

        // Check the specifics of the message, ensuring that the properties are present
        const snapshot = message.snapshot;
        expect(snapshot).toBeDefined();

        // Publish another TagData delta
        const tagDataDelta = new TagData();
        tagDataDelta.identifier = identifier.clone();
        tagDataDelta.data = "Test Delta Value";
        await publisher.send(tagDataDelta);

        // Wait for the delta message to reach Redis Subscriber through Worker
        await waitFor(2000);

        // Dequeue deltas until the queue is empty
        const deltaMessage = await snapshotsQueue.get();

        // Check the specifics of the delta message
        const delta = deltaMessage.delta;
        expect(delta).toBeDefined();

        // Assert the field in the delta
        expect(delta?.data).toEqual(tagDataDelta.data);
    });

    function getRedisSnapshotKey(identifier: TagDataObjectIdentifier): string {
        const snapIdentifier = identifier.clone();
        snapIdentifier.name = "";
        return Buffer.from(snapIdentifier.toBinary()).toString("base64");
    }
});