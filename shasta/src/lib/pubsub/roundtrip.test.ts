import {ITopicConfig} from "kafkajs";
import Redis, {ClusterNode, RedisOptions} from 'ioredis';
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {Publisher} from './publisher';
import {Subscriber} from './subscriber';
import {Worker} from './worker';
import {createKafka} from "../kafka/createKafka";
import crypto from "crypto";
import {Deferred} from "@esfx/async";

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
    let redisClient: Redis;

    beforeAll(async () => {
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

        // Disconnect the admin interface
        await admin.disconnect();

        // Create and connect the Publisher
        publisher = new Publisher(kafka, kafkaTopic);
        await publisher.connect();

        // Create the Redis client
        const redisOptions = REDIS_OPTIONS;
        redisClient = new Redis(redisOptions);
        console.log('redis: ', redisOptions);
        const nodes: ClusterNode[] = [
            {host: "shasta-redis-automation788-0001-001", port: 6379},
            {host: "shasta-redis-automation788-0001-002", port: 6379},
            {host: "shasta-redis-automation788-0002-001", port: 6379},
            {host: "shasta-redis-automation788-0002-002", port: 6379},
        ];

        // Create the Subscriber
        const tagDataObjIdentifier = new TagDataObjectIdentifier();
        tagDataObjIdentifier.appId = `some-app-id-${crypto.randomUUID()}`;
        subscriber = new Subscriber(redisOptions, nodes, tagDataObjIdentifier);

        // Create the Worker
        const groupId = `test-group-id-${crypto.randomUUID()}`;
        worker = new Worker(kafka, groupId, kafkaTopic, redisOptions, nodes);
        await worker.groupJoined();
    });

    afterAll(async () => {
        // Disconnect and cleanup resources
        await worker.shutdown();
        await publisher.disconnect();
        await redisClient.disconnect();
        await subscriber.disconnect();
    });

    it('should process messages from Publisher to Worker via Redis Subscriber', async () => {
        const tagData = new TagData();
        const identifier = new TagDataObjectIdentifier();
        identifier.appId = `some-app-id-${crypto.randomUUID()}`;
        identifier.name = `name-${crypto.randomUUID()}`;
        tagData.identifier = identifier;
        tagData.data = 'Test Value';

        // Send TagData message from Publisher
        await publisher.send(tagData);
        console.log('publisher.send')

        // Wait for the message to reach Redis Subscriber through Worker
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Use additional assertions and expectations to validate the processing and persistence of the message
        // For example, check if the message is present in the Redis snapshot using Redis client API, or assert specific actions performed by the Worker or Subscriber
        // You can also modify the Worker or Subscriber classes to expose additional methods or properties to aid in testing and assertions
        // Use Redis client to retrieve data from Redis and assert on the expected state

        // Example assertion: Check if the message has been added to Redis snapshot
        console.log('redisClient.hgetall')
        identifier.name = "";
        const redisSnapshotData = await redisClient.hgetall(Buffer.from(identifier.toBinary()));
        console.log('redisClient.hgetall.2')
        console.log(redisSnapshotData);

        expect(redisSnapshotData).toBeDefined();
        expect(redisSnapshotData['deltaKey']).toBeDefined();
    });
});