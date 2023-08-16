import crypto from "crypto";
import {createKafka} from "../kafka/createKafka";
import {ITopicConfig, ITopicMetadata, Kafka} from "kafkajs";
import {slog} from "../logger/slog";
import {Deferred, delay} from "@esfx/async";
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {Publisher} from "./publisher";
import {Subscriber} from "./subscriber";
import {Worker} from "./worker";
import {AsyncQueue} from "@esfx/async-queue";
import {expect} from "chai";
import {Instrumentation} from "./instrument";
import {RedisKeyCleanup} from "./redisKeyCleanup";
import {envVarsSync} from "../../automation";

export const pairCount = 256; // Number of publisher/subscriber pairs
export const messageCount = 1024 * 4; // Number of published messages per pair

const kafkaTopicLoad = `test_topic_load-${crypto.randomUUID()}`;
let sanityCountSub = 0;
let sanityCountPub = 0;

const maxConcurrentConnects = 10;
// https://docs.aws.amazon.com/msk/latest/developerguide/limits.html

const workerModulo = 32;

const pairs = new Array<TestRef>();

envVarsSync();

export async function deleteTestTopics() {
    const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);
    const admin = kafka.admin();
    try {
        await admin.connect();

        // List all topics in the Kafka cluster
        const topicMetadata = await admin.fetchTopicMetadata();
        const topics = topicMetadata.topics.map((topicInfo) => topicInfo.name);

        // Filter the topics that contain "test" (case-insensitive)
        const testTopics = topics.filter((topic) => /test/i.test(topic));
        slog.info("deleteTestTopics", {testTopics});

        // Delete the filtered topics
        await admin.deleteTopics({topics: testTopics});

        await admin.disconnect();

        await delay(3000);
    } finally {
        await admin.disconnect();
    }
}

export interface TestRef {
    publisher: Publisher;
    subscriber: Subscriber;
    worker: Worker | null;
    tagDataObjectIdentifier: TagDataObjectIdentifier;
}

export async function setupKafkaPairs(pairs: TestRef[], n: number): Promise<void> {
    const setupPromises: Promise<TestRef>[] = [];
    const groupId = `test-group-id-${crypto.randomUUID()}`;

    const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);

    const admin = kafka.admin();
    await admin.connect();
    try {
        const topicConfig: ITopicConfig = {
            topic: kafkaTopicLoad,
            numPartitions: 16,
        };
        await admin.createTopics({
            topics: [topicConfig],
        });

        // Repeatedly check if the topic has been created.
        let topicExists = false;
        const timeoutMs = 5000;
        const startTime = Date.now();

        while (!topicExists) {
            const metadata = await admin.fetchTopicMetadata({topics: [kafkaTopicLoad]});
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
    } finally {
        await admin.disconnect();
    }

    for (let i = 0; i < n; i++) {
        const setupPromise = setup(i, groupId, kafka);
        setupPromises.push(setupPromise);

        if (setupPromises.length === maxConcurrentConnects || i === n - 1) {
            await Promise.all(setupPromises)
                .then((results) => {
                    pairs.push(...results);
                    slog.info("setupKafkaPairs", { pairs: pairs.length });
                })
                .finally(() => {
                    setupPromises.length = 0;
                });
            await delay(3000);
        }
    }
}

export async function teardownTest(pairs: TestRef[]) {
    const tasks = pairs.map(async ({ worker, publisher, subscriber }) => {
        await worker?.shutdown();
        await publisher.disconnect();
        await subscriber.disconnect();
    });

    await Promise.all(tasks);
}

async function setup(i: number, groupId: string, kafka: Kafka): Promise<TestRef> {
    const tagDataObjectIdentifier = new TagDataObjectIdentifier();
    tagDataObjectIdentifier.appId = `some-app-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.tag = `tag-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.scope = `scope-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.name = `name-${crypto.randomUUID()}`;

    const publisher = new Publisher(kafka, kafkaTopicLoad);
    await publisher.connect();

    const subscriber = new Subscriber(tagDataObjectIdentifier);

    const worker = (i % workerModulo == 0) ? await Worker.create(kafka, groupId, kafkaTopicLoad) : null;
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

export async function runLoadTest(pairs: TestRef[], m: number) {
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

        // consume
        const doneConsuming = new Deferred<boolean>();
        const consumeTask = async() => {
            const snapshot = await messageQueue.get();
            expect(snapshot.snapshot).to.not.be.undefined;

            for (; ;) {
                const receivedMsg = await messageQueue.get();
                expect(receivedMsg.delta).to.not.be.undefined;
                if (receivedMsg.delta?.data && testValTracker.has(receivedMsg.delta?.data)) {
                    testValTracker.delete(receivedMsg.delta?.data);

                    sanityCountSub++;
                    if (sanityCountSub % 1000 === 0)
                        slog.info("sanityCountSub", {sanityCountSub});
                }
                if (testValTracker.size === 0) {
                    doneConsuming.resolve(true);
                    break;
                }
            }
        };
        const notUsed = consumeTask();

        // produce
        const tagDataArray = new Array<TagData>();
        for (let i = 0; i < m; i++) {
            const testVal = testValFormat(uuidSubStream, i);
            const tagDataObjectIdentifierNamed = testRef.tagDataObjectIdentifier.clone();
            tagDataObjectIdentifierNamed.name = `name-${crypto.randomUUID()}`;
            const tagData = new TagData({
                identifier: tagDataObjectIdentifierNamed,
                data: testVal,
            });
            testValTracker.add(testVal);
            Instrumentation.instance.getTimestamps(tagData.identifier!).beforePublish = performance.now();

            //tagDataArray.push(tagData);
            await testRef.publisher.send(tagData);
            // todo no batching

            sanityCountPub++;
            if(sanityCountPub % 1000 === 0)
                slog.info("sanityCountPub", { sanityCountPub });
        }
        //await testRef.publisher.sendBatch(tagDataArray); todo no batching
        const now = performance.now();
        for(const tagData of tagDataArray) { Instrumentation.instance.getTimestamps(tagData.identifier!).afterPublish = now; }

        await doneConsuming.promise;

        slog.info("runLoadTest", { iteration: testValTracker.size, testVal: testValFormat(uuidSubStream, 0) });
        completions.put(testRef.tagDataObjectIdentifier);
    });

    await Promise.all(runTestTasks);
}

export async function loadTest() {
    await setupKafkaPairs(pairs, pairCount);
    slog.info("runLoadTest");

    const start = Date.now();
    await runLoadTest(pairs, messageCount);
    const elapsed = Date.now() - start;

    const total = pairs.length * messageCount;
    slog.info(`stats:`,{ elapsed, pairs: pairs.length, messageCount, total, event_rate_per_second: total / (elapsed / 1000) });
    Instrumentation.instance.dump();
    await teardownTest(pairs);

    return sanityCountSub;
}
