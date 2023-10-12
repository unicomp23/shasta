import crypto from "crypto";
import {createKafka, singleServerTcpSpacingMillis} from "../kafka/createKafka";
import {ITopicConfig, ITopicMetadata, Kafka} from "kafkajs";
import {slog} from "../logger/slog";
import {Deferred, delay} from "@esfx/async";
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {Publisher} from "./publisher";
import {Subscriber} from "./subscriber";
import {Worker} from "./worker";
import {expect} from "chai";
import {Instrumentation} from "./instrument";
import {envVarsSync} from "../../automation";
import {env} from "process";
import { RedisKeyCleanup } from './redisKeyCleanup';

export const pairCount = 32; // Number of publisher/subscriber pairs
export const messageCount = 64; // Number of published messages per pair

let sanityCountSub = 0;
let sanityCountPub = 0;

const workerModulo = 4;

const pairs = new Array<TestRef>();

enum TestType {
    Consumer = "consumer",
    Producer = "producer",
    Both = "both",
}

const testType = TestType.Both;

// todo revert, envVarsSync();

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
    publisher: Publisher | null;
    subscriber: Subscriber | null;
    worker: Worker | null;
    tagDataObjectIdentifier: TagDataObjectIdentifier;
}

export async function setupKafkaPairs(kafkaTopicLoad: string, pairs: TestRef[], pairCount: number, numCPUs: number, groupId: string): Promise<void> {
    const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`, "us-east-1", numCPUs);

    const admin = kafka.admin();
    await admin.connect();
    try {
        const topicConfig: ITopicConfig = {
            topic: kafkaTopicLoad,
            numPartitions: 256,
        };
        await admin.createTopics({
            topics: [topicConfig],
        });

        // Repeatedly check if the topic has been created.
        let topicExists = false;
        const timeoutMs = 5000;
        const startTime = Date.now();

        while (!topicExists) {
            try {
                await delay(3000);
                const metadata = await admin.fetchTopicMetadata({topics: [kafkaTopicLoad]});
                if (findTopicInMetadata(kafkaTopicLoad, metadata.topics)) {
                    topicExists = true;
                    break;
                } else {
                    // If the timeout is hit, throw an error.
                    if (Date.now() - startTime > timeoutMs) {
                        throw new Error(`Timed out waiting for topic '${kafkaTopicLoad}' to be created.`);
                    }
                }
            } catch(error) {
                console.log(error);
            }
        }
    } finally {
        await admin.disconnect();
    }

    for (let i = 0; i < pairCount; i++) {
        const testRef = await setup(kafkaTopicLoad, i, groupId, kafka);
        pairs.push(testRef);
        //if(i % 100 === 0)
            slog.info("setupKafkaPairs", { pairs: pairs.length });
        // todo, await delay(numCPUs * singleServerTcpSpacingMillis);
        await delay(3000);
    }
}

export async function teardownTest(pairs: TestRef[]) {
    const tasks = pairs.map(async ({ worker, publisher, subscriber }) => {
        await worker?.shutdown();
        await publisher?.disconnect();
        await subscriber?.disconnect();
    });

    await Promise.all(tasks);
}

async function setup(kafkaTopicLoad: string, i: number, groupId: string, kafka: Kafka): Promise<TestRef> {
    const tagDataObjectIdentifier = new TagDataObjectIdentifier();
    tagDataObjectIdentifier.appId = `some-app-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.tag = `tag-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.scope = `scope-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.name = `name-${crypto.randomUUID()}`;

    let publisher: Publisher | null = null;
    // @ts-ignore
    if(testType === TestType.Producer || testType === TestType.Both) {
        publisher = new Publisher(kafka, kafkaTopicLoad);
        await publisher.connect();
    }

    let subscriber: Subscriber | null = null;
    // @ts-ignore
    if(testType === TestType.Producer || testType === TestType.Both) {
        // redis subscriber runs on the same process as the publisher to validate the messages
        subscriber = new Subscriber(tagDataObjectIdentifier);
    }

    let worker: Worker | null = null;
    // @ts-ignore
    if(testType === TestType.Consumer || testType === TestType.Both) {
        worker = (i % workerModulo == 0) ? await Worker.create(kafka, groupId, kafkaTopicLoad) : null;
        if (worker !== null) slog.info("setup worker", {
            i,
            groupId,
            kafkaTopicLoad
        });
    }

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

export async function runLoadTest(pairs: TestRef[], m: number, numCPUs: number) {
    const runTestTasks = pairs.map(async (testRef) => {
        if (testRef.tagDataObjectIdentifier.name === "" || testRef.tagDataObjectIdentifier.name === undefined) {
            throw new Error("TagDataObjectIdentifier name is empty");
        }

        const uuidSubStream = crypto.randomUUID();
        const testValFormat = (uuid: string, counter: number) => `Load test Value: ${uuid}, ${counter}`;
        const testValTracker = new Set<string>();

        if(testRef.worker) await testRef.worker.groupJoined();
        const messageQueue = await testRef.subscriber?.stream();

        // consume
        const doneConsuming = new Deferred<boolean>();
        const consumeTask = async() => {
            if(messageQueue) {
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
            // todo, await delay(50 * numCPUs);
            await delay(1000);
            Instrumentation.instance.getTimestamps(tagData.identifier!).beforePublish = Date.now();

            //tagDataArray.push(tagData);
            await testRef.publisher?.send(tagData);
            Instrumentation.instance.getTimestamps(tagData.identifier!).afterPublish = Date.now();
            // todo no batching

            sanityCountPub++;
            if(sanityCountPub % 1000 === 0)
                slog.info("sanityCountPub", { sanityCountPub });
        }
        //await testRef.publisher.sendBatch(tagDataArray); todo no batching

        await doneConsuming.promise;

        slog.info("runLoadTest", { iteration: testValTracker.size, testVal: testValFormat(uuidSubStream, 0) });
    });

    await Promise.all(runTestTasks);
}

export async function loadTest(kafkaTopicLoad: string, numCPUs: number, groupId: string) {
    await setupKafkaPairs(kafkaTopicLoad, pairs, pairCount, numCPUs, groupId);
    slog.info("runLoadTest");

    const start = Date.now();
    await runLoadTest(pairs, messageCount, numCPUs);
    const elapsed = Date.now() - start;

    const total = pairs.length * messageCount;
    slog.info(`stats:`,{ elapsed, pairs: pairs.length, messageCount, total, event_rate_per_second: total / (elapsed / 1000) });
    Instrumentation.instance.dump();
    await teardownTest(pairs);

    return sanityCountSub;
}

export const numCPUs = 1;

export async function main() {
    if(env.MEMORY_DB_ENDPOINT_ADDRESS && env.MEMORY_DB_ENDPOINT_ADDRESS.length > 0)
    env.REDIS_HOST = env.MEMORY_DB_ENDPOINT_ADDRESS;
    env.REDIS_PORT = "6379";
    if(env.BOOTSTRAP_BROKERS && env.BOOTSTRAP_BROKERS.length > 0)
        env.KAFKA_BROKERS = env.BOOTSTRAP_BROKERS;

    /*** todo await deleteTestTopics();
    const cleaner = new RedisKeyCleanup();
    cleaner.deleteAllKeys()
        .then(() => cleaner.disconnect())
        .catch(console.error); ***/

    console.log(`numCPUs: ${numCPUs}`);
    const randomTag = "041"; // todo crypto.randomUUID();
    const kafkaTopicLoad = `test_topic_load-${randomTag}`;
    const groupId = `test_group_id-${randomTag}`;

    const sanityCountSub = await loadTest(kafkaTopicLoad, numCPUs, groupId);
    await delay(10000);
    expect(sanityCountSub).to.equal(pairCount * messageCount);
}

main().then(() => {
    console.log('exit main');
});
