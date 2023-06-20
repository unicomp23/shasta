import { Kafka, KafkaMessage, Message, EachMessagePayload, Producer } from 'kafkajs';
import Redis, { RedisOptions } from 'ioredis';
import { TagData, TagDataObjectIdentifier } from "../../../submodules/src/gen/tag_data_pb";
import { Publisher } from './publisher';
import { Subscriber } from './subscriber';
import { Worker } from './worker';
import {createKafka} from "../kafka/createKafka";
import crypto from "crypto";

const REDIS_OPTIONS: RedisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
};

// Kafka topic for testing
const kafkaTopic = `test_topic-${crypto.randomUUID()}`;

describe('End-to-End Test', () => {
    let publisher: Publisher;
    let subscriber: Subscriber;
    let worker: Worker;
    let redisClient: Redis;

    beforeAll(async () => {
        // Create the Kafka instance
        const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);

        // Create and connect the Publisher
        publisher = new Publisher(kafka, kafkaTopic);
        await publisher.connect();

        // Create the Redis client
        const redisOptions = REDIS_OPTIONS;
        redisClient = new Redis(redisOptions);

        // Create the Subscriber
        const tagDataObjIdentifier = new TagDataObjectIdentifier();
        tagDataObjIdentifier.appId = 'some-id';
        subscriber = new Subscriber(redisOptions, tagDataObjIdentifier);

        // Create the Worker
        const groupId = 'test-group';
        worker = new Worker(kafka, groupId, kafkaTopic, redisOptions);

        // Wait for the Worker to initialize and subscribe to the Kafka topic
        await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
        // Disconnect and cleanup resources
        await publisher.disconnect();
        worker.shutdown();
        await redisClient.quit();
    });

    it('should process messages from Publisher to Worker via Redis Subscriber', async () => {
        const tagData = new TagData();
        const identifier = new TagDataObjectIdentifier();
        identifier.appId = 'some-id';
        tagData.identifier = identifier;
        tagData.data = 'Test Value';

        // Send TagData message from Publisher
        await publisher.send(tagData);

        // Wait for the message to reach Redis Subscriber through Worker
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Use additional assertions and expectations to validate the processing and persistence of the message
        // For example, check if the message is present in the Redis snapshot using Redis client API, or assert specific actions performed by the Worker or Subscriber
        // You can also modify the Worker or Subscriber classes to expose additional methods or properties to aid in testing and assertions
        // Use Redis client to retrieve data from Redis and assert on the expected state

        // Example assertion: Check if the message has been added to Redis snapshot
        const redisSnapshotData = await redisClient.hgetall(Buffer.from(identifier.toBinary()));
        expect(redisSnapshotData).toBeDefined();
        expect(redisSnapshotData['deltaKey']).toBeDefined();
    });
});