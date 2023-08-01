import {ITopicConfig, ITopicMetadata} from "kafkajs";
import {
    TagData,
    TagDataObjectIdentifier,
} from "../../../submodules/src/gen/tag_data_pb";
import { Publisher } from "./publisher";
import { Subscriber } from "./subscriber";
import { Worker } from "./worker";
import { createKafka } from "../kafka/createKafka";
import crypto from "crypto";
import { envVarsSync } from "../../automation";
import { expect } from "chai";
import { describe, it } from "mocha";
import { AsyncQueue } from "@esfx/async-queue";
import { Kafka } from "kafkajs";
import { slog } from "../logger/slog";
import {RedisKeyCleanup} from "./redisKeyCleanup";
import {delay} from "@esfx/async";

envVarsSync();

const pairCount = 128; // Number of publisher/subscriber pairs
const messageCount = 1024; // Number of published messages per pair

const kafkaTopicLoad = `test_topic_load-${crypto.randomUUID()}`;
let sanityCountSub = 0;
let sanityCountPub = 0;

async function deleteTestTopics(kafka: Kafka) {
    const admin = kafka.admin();
    await admin.connect();

    // List all topics in the Kafka cluster
    const topicMetadata = await admin.fetchTopicMetadata();
    const topics = topicMetadata.topics.map((topicInfo) => topicInfo.name);

    // Filter the topics that contain "test" (case-insensitive)
    const testTopics = topics.filter((topic) => /test/i.test(topic));
    slog.info("deleteTestTopics", { testTopics });

    // Delete the filtered topics
    await admin.deleteTopics({ topics: testTopics });

    await admin.disconnect();

    await delay(3000);
}

interface TestRef {
    publisher: Publisher;
    subscriber: Subscriber;
    worker: Worker | null;
    tagDataObjectIdentifier: TagDataObjectIdentifier;
}

describe("End-to-End Load Test", () => {
    const pairs = new Array<TestRef>();

    before(async () => {
        expect(sanityCountSub).to.equal(0);
    });

    after(async () => {
        await teardown(pairs);
        expect(sanityCountSub).to.equal(pairCount * messageCount);
    });

    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {
        const cleaner = new RedisKeyCleanup();
        cleaner.deleteAllKeys()
            .then(() => cleaner.disconnect())
            .catch(console.error);

        await setupKafkaPairs(pairs, pairCount);
        slog.info("runLoadTest");
        const start = Date.now();
        await runLoadTest(pairs, messageCount);
        const elapsed = Date.now() - start;
        const total = pairs.length * messageCount;
        slog.info(`stats:`,{ elapsed, pairs: pairs.length, messageCount, total, event_rate_per_second: total / (elapsed / 1000) });
    });
});

async function setupKafkaPairs(pairs: TestRef[], n: number): Promise<void> {
    const maxConcurrent = 16;
    const setupPromises: Promise<TestRef>[] = [];

    for (let i = 0; i < n; i++) {
        const setupPromise = setup(i);
        setupPromises.push(setupPromise);

        if (setupPromises.length === maxConcurrent || i === n - 1) {
            await Promise.all(setupPromises)
                .then((results) => {
                    pairs.push(...results);
                    slog.info("setupKafkaPairs", { pairs: pairs.length });
                })
                .finally(() => {
                    setupPromises.length = 0;
                });
        }
    }
}

async function teardown(pairs: TestRef[]) {
    const tasks = pairs.map(async ({ worker, publisher, subscriber }) => {
        await worker?.shutdown();
        await publisher.disconnect();
        await subscriber.disconnect();
    });

    await Promise.all(tasks);
}

async function setup(i: number): Promise<TestRef> {
    const tagDataObjectIdentifier = new TagDataObjectIdentifier();
    tagDataObjectIdentifier.appId = `some-app-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.tag = `tag-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.scope = `scope-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.name = `name-${crypto.randomUUID()}`;

    const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);
    //await deleteTestTopics(kafka);

    const admin = kafka.admin();
    await admin.connect();
    const topicConfig: ITopicConfig = {
        topic: kafkaTopicLoad,
        //numPartitions: 100,
    };
    await admin.createTopics({
        topics: [topicConfig],
    });

    // Repeatedly check if the topic has been created.
    let topicExists = false;
    const timeoutMs = 5000;
    const startTime = Date.now();

    while (!topicExists) {
        const metadata = await admin.fetchTopicMetadata({ topics: [kafkaTopicLoad] });
        if (findTopicInMetadata(kafkaTopicLoad, metadata.topics)) {
            topicExists = true;
        } else {
            // If the timeout is hit, throw an error.
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timed out waiting for topic '${kafkaTopicLoad}' to be created.`);
            }
            // Otherwise, wait 500 ms before the next check.
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    await admin.disconnect();

    const publisher = new Publisher(kafka, kafkaTopicLoad);
    await publisher.connect();

    const subscriber = new Subscriber(tagDataObjectIdentifier);

    const groupId = `test-group-id-${crypto.randomUUID()}`;
    const worker = (i % 32 == 0) ? await Worker.create(kafka, groupId, kafkaTopicLoad) : null;
    if(worker !== null) slog.info("setup worker", { i, groupId, kafkaTopicLoad });

    return {
        publisher,
        subscriber,
        worker,
        tagDataObjectIdentifier,
    };
}

// Helper function to find the topic in the topic metadata object.
function findTopicInMetadata(topic: string, metadata: ITopicMetadata[]): boolean {
    return metadata.some((topicMetadata: ITopicMetadata) => topicMetadata.name === topic);
}

async function runLoadTest(pairs: TestRef[], m: number) {
    const completions = new AsyncQueue<TagDataObjectIdentifier>();

    const runTestTasks = pairs.map(async (testRef) => {
        if (testRef.tagDataObjectIdentifier.name === "" || testRef.tagDataObjectIdentifier.name === undefined) {
            throw new Error("TagDataObjectIdentifier name is empty");
        }

        const uuidSubStream = crypto.randomUUID();
        const testValFormat = (uuid: string, counter: number) => `Load test Value: ${uuid}, ${counter}`;
        const testValTracker = new Set<string>();

        if(testRef.worker) await testRef.worker.groupJoined();
        const messageQueue = await testRef.subscriber.stream();

        for (let i = 0; i < m; i++) {
            const testVal = testValFormat(uuidSubStream, i);
            const tagData = new TagData({
                identifier: testRef.tagDataObjectIdentifier,
                data: testVal,
            });
            testValTracker.add(testVal);
            await testRef.publisher.send(tagData);

            sanityCountPub++;
            if(sanityCountPub % 1000 === 0)
                slog.info("sanityCountPub", { sanityCountPub });
        }

        const snapshot = await messageQueue.get();
        expect(snapshot.snapshot).to.not.be.undefined;

        for (;;) {
            const receivedMsg = await messageQueue.get();
            expect(receivedMsg.delta).to.not.be.undefined;
            if (receivedMsg.delta?.data && testValTracker.has(receivedMsg.delta?.data)) {
                testValTracker.delete(receivedMsg.delta?.data);

                sanityCountSub++;
                if(sanityCountSub % 1000 === 0)
                    slog.info("sanityCountSub", { sanityCountSub });
            }
            if (testValTracker.size === 0) break;
        }

        slog.info("runLoadTest", { iteration: testValTracker.size, testVal: testValFormat(uuidSubStream, 0) });
        completions.put(testRef.tagDataObjectIdentifier);
    });

    await Promise.all(runTestTasks);
}