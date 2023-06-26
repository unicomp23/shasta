import {ITopicConfig} from "kafkajs";
import Redis, {Cluster, ClusterNode, RedisOptions} from 'ioredis';
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {Publisher} from './publisher';
import {Subscriber} from './subscriber';
import {Worker} from './worker';
import {createKafka} from "../kafka/createKafka";
import crypto from "crypto";
import {Deferred, delay} from "@esfx/async";
import {env} from "process";

const REDIS_OPTIONS: RedisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    tls:{},
};

// Kafka topic for testing
const kafkaTopic = `test_topic-${crypto.randomUUID()}`;

describe('End-to-End Test 2', () => {
    let publisher: Publisher;
    let subscriber: Subscriber;
    let worker: Worker;
    let redisClient: Cluster;
    const identifier = new TagDataObjectIdentifier();


    beforeAll(async () => {
        identifier.appId = `some-app-id-${crypto.randomUUID()}`;
        identifier.tag = `tag-id-${crypto.randomUUID()}`;
        identifier.scope = `scope-id-${crypto.randomUUID()}`
        identifier.name = `name-${crypto.randomUUID()}`;

        // Create the Kafka instance
        const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);

        // Create the Kafka admin interface
        const admin = kafka.admin();
        await admin.connect();

        // Pre-create the Kafka topic
        const topicConfig: ITopicConfig = {
            topic: kafkaTopic,
        };
        await admin.createTopics({
            topics: [topicConfig],
        });
        console.log({topicConfig})

        const listTopics = await admin.listTopics();
        console.log({listTopics})
        if(!listTopics.includes(kafkaTopic))
            console.error(`topic not confirmed: `, {kafkaTopic});
        else
            console.log(`topic confirmed: `, {kafkaTopic});


        // Disconnect the admin interface
        await admin.disconnect();

        // Create and connect the Publisher
        publisher = new Publisher(kafka, kafkaTopic);
        await publisher.connect();

        // Create the Redis client
        redisClient = new Cluster ([ { host: env.REDIS_HOST, port: parseInt(env.REDIS_PORT || "6379") }], { dnsLookup: (address, callback) => callback (null, address), redisOptions: { tls: {}, }, });
        console.log('redis: ', env.REDIS_HOST);

        // Create the Subscriber
        subscriber = new Subscriber(identifier);

        // Create the Worker
        const groupId = `test-group-id-${crypto.randomUUID()}`;
        worker = new Worker(kafka, groupId, kafkaTopic);
        await worker.groupJoined();
    });

    afterAll(async () => {
        // Disconnect and cleanup resources
        await worker.shutdown();
        await publisher.disconnect();
        await redisClient.quit();
        await subscriber.disconnect();
    });

    it('should process messages from Publisher to Worker via Redis Subscriber', async () => {
        const tagData = new TagData();
        tagData.identifier = identifier;
        tagData.data = 'Test Value';

        // Send TagData message from Publisher
        await publisher.send(tagData);
        console.log('publisher.send', {tagData})

        // Wait for the message to reach Redis Subscriber through Worker
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Use additional assertions and expectations to validate the processing and persistence of the message
        // For example, check if the message is present in the Redis snapshot using Redis client API, or assert specific actions performed by the Worker or Subscriber
        // You can also modify the Worker or Subscriber classes to expose additional methods or properties to aid in testing and assertions
        // Use Redis client to retrieve data from Redis and assert on the expected state

        // Example assertion: Check if the message has been added to Redis snapshot
        const snapIdentifier = identifier.clone();
        snapIdentifier.name = "";
        const redisSnapshotKey = Buffer.from(snapIdentifier.toBinary()).toString("base64");
        const commonRedisSnapshotKey = `{${redisSnapshotKey}}:snap:`;

        const redisSnapshotData = await redisClient.hgetall(commonRedisSnapshotKey);
        console.log('redisClient.hgetall.2', {commonRedisSnapshotKey, redisSnapshotData});

// Retrieve snapshots from Subscriber
        const snapshotsQueue = await subscriber.stream();

// Dequeue snapshots until queue is empty
        const message = await snapshotsQueue.get();

// Check the specifics of the message, ensuring that the properties are present
        const snapshot = message.snapshot;
        console.log('redisClient.hgetall.snap', {snapshot});

        /*
                expect(redisSnapshotData).toBeDefined();
                expect(redisSnapshotData['deltaKey']).toBeDefined();
                 */
    });
});