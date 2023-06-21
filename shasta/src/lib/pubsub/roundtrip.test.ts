import { Kafka } from 'kafkajs';
import Redis, { RedisOptions } from 'ioredis';
import { Publisher } from './publisher';
import { Subscriber } from './subscriber';
import { Worker } from './worker';
import { TagData, TagDataObjectIdentifier } from '../../../submodules/src/gen/tag_data_pb';
import { createKafka } from '../kafka/createKafka';
import { v4 as uuidv4 } from 'uuid';

// Create a unique Kafka topic for testing
const kafkaTopic = `test_topic-${uuidv4()}`;

// Create Kafka and Redis clients
const kafka = createKafka('test-consumer');
const redisOptions: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};
const redisClient = new Redis(redisOptions);

// Create and connect the Publisher, Subscriber, and Worker
let publisher: Publisher;
let subscriber: Subscriber;
let worker: Worker;

beforeAll(async () => {
    // Pre-create the Kafka topic
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
        topics: [{ topic: kafkaTopic }],
    });
    await admin.disconnect();

    // Create the Publisher
    publisher = new Publisher(kafka, kafkaTopic);
    await publisher.connect();

    // Create the Subscriber
    const tagDataObjIdentifier = new TagDataObjectIdentifier();
    tagDataObjIdentifier.appId = `some-app-id-${uuidv4()}`;
    subscriber = new Subscriber(redisOptions, tagDataObjIdentifier);

    // Create the Worker
    const groupId = `test-group-id-${uuidv4()}`;
    worker = new Worker(kafka, groupId, kafkaTopic, redisOptions);
    await worker.groupJoined();
});

afterAll(async () => {
    // Disconnect and clean up resources
    await worker.shutdown();
    await publisher.disconnect();
    await subscriber.disconnect();
    await redisClient.disconnect();
});

describe('Integration Tests', () => {
    test('Publish message and verify processing and persistence', async () => {
        // Create a TagData message to publish
        const tagData = new TagData();
        const identifier = new TagDataObjectIdentifier();
        identifier.appId = `some-app-id-${uuidv4()}`;
        tagData.identifier = identifier;
        tagData.data = 'Test Value';

        // Publish the TagData message
        await publisher.send(tagData);

        // Wait for the message to be processed and persisted
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Retrieve the updated data from Redis
        const redisSnapshotKey = Buffer.from(identifier.toBinary());
        const redisSnapshotData = await redisClient.hgetall(redisSnapshotKey);

        // Assert that the message has been processed correctly and the data has been updated in Redis
        expect(redisSnapshotData).toBeDefined();
        expect(redisSnapshotData[tagData.identifier?.name || '']).toBeDefined();
    });
});