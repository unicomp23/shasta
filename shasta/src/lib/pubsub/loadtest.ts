import crypto from "crypto";
import {createKafka} from "../kafka/createKafka";
import {ITopicConfig, ITopicMetadata, Kafka} from "kafkajs";
import {slog} from "../logger/slog";
import {Deferred, delay} from "@esfx/async";
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {Publisher} from "./publisher";
import {Subscriber} from "./subscriber";
import {Worker} from "./worker";
import {expect} from "chai";
import {Instrumentation} from "./instrument";
import {env} from "process";
import {createAndVerifyKafkaTopic, generateTopicAndGroupId} from "./topic";
import fs from "fs";

export const pairCount = 8; // Number of publisher/subscriber pairs
export const messageCount = 1800; // Number of published messages per pair

let sanityCountSub = 0;
let sanityCountPub = 0;

const workerModulo = 8;
const eventSpacingMillis = 1000;

const pairs = new Array<TestRef>();

enum TestType {
    Consumer = "consumer",
    Producer = "producer",
    Both = "both",
}

const testType = TestType.Both;

// todo revert, envVarsSync();

export interface TestRef {
    publisher: Publisher | null;
    subscriber: Subscriber | null;
    worker: Worker | null;
    tagDataObjectIdentifier: TagDataObjectIdentifier;
}

export async function setupKafkaPairs(kafkaTopicLoad: string, pairs: TestRef[], pairCount: number, numCPUs: number, groupId: string): Promise<void> {
    const kafka = await createKafka(`test-kafka-id-${crypto.randomUUID()}`, "us-east-1", numCPUs);

    const baseDelay = 20000;
    await delay(baseDelay * Math.random());
    for (let i = 0; i < pairCount; i++) {
        const testRef = await setup(kafkaTopicLoad, i, groupId, kafka);
        pairs.push(testRef);
        //if(i % 100 === 0)
        slog.info("setupKafkaPairs", {pairs: pairs.length});
        // todo, await delay(numCPUs * singleServerTcpSpacingMillis);
        await delay(baseDelay);
    }
}

export async function teardownTest(pairs: TestRef[]) {
    const tasks = pairs.map(async ({worker, publisher, subscriber}) => {
        await worker?.shutdown();
        await publisher?.disconnect();
        await subscriber?.disconnect();
    });

    await Promise.allSettled(tasks).catch((error) => {
        console.error('An error occurred while tearing down the test:', error);
    });
}

async function setup(kafkaTopicLoad: string, i: number, groupId: string, kafka: Kafka): Promise<TestRef> {
    const tagDataObjectIdentifier = new TagDataObjectIdentifier();
    tagDataObjectIdentifier.appId = `some-app-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.tag = `tag-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.scope = `scope-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.name = `name-${crypto.randomUUID()}`;

    let publisher: Publisher | null = null;
    // @ts-ignore
    if (testType === TestType.Producer || testType === TestType.Both) {
        publisher = new Publisher(kafka, kafkaTopicLoad);
        await publisher.connect();
    }

    let subscriber: Subscriber | null = null;
    // @ts-ignore
    if (testType === TestType.Producer || testType === TestType.Both) {
        // redis subscriber runs on the same process as the publisher to validate the messages
        subscriber = new Subscriber(tagDataObjectIdentifier);
    }

    let worker: Worker | null = null;
    // @ts-ignore
    if (testType === TestType.Consumer || testType === TestType.Both) {
        const consumerFileExists = true; // todo fs.existsSync('/tmp/consumer.txt');
        worker = (i % workerModulo == 0 && consumerFileExists) ? await Worker.create(kafka, groupId, kafkaTopicLoad) : null;
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

export async function runLoadTest(pairs: TestRef[], m: number, numCPUs: number) {
    const runTestTasks = pairs.map(async (testRef) => {
        try {
            if (testRef.tagDataObjectIdentifier.name === "" || testRef.tagDataObjectIdentifier.name === undefined) {
                throw new Error("TagDataObjectIdentifier name is empty");
            }

            const uuidSubStream = crypto.randomUUID();
            const testValFormat = (uuid: string, counter: number) => `Load test Value: ${uuid}, ${counter}`;

            if (testRef.worker) await testRef.worker.groupJoined();
            const messageQueue = await testRef.subscriber?.stream();

            const testValTracker = new Set<string>();
            for (let i = 0; i < m; i++) {
                const testVal = testValFormat(uuidSubStream, i);
                testValTracker.add(testVal);
            } // pre-populate to avoid race

            // consume
            const doneConsuming = new Deferred<boolean>();
            const consumeTask = async () => {
                if (messageQueue) {
                    const snapshot = await messageQueue.get();
                    expect(snapshot.snapshot).to.not.be.undefined;

                    while (testValTracker.size > 0) {
                        const receivedMsg = await messageQueue.get();
                        expect(receivedMsg.delta).to.not.be.undefined;
                        if (receivedMsg.delta?.data && testValTracker.has(receivedMsg.delta?.data)) {
                            testValTracker.delete(receivedMsg.delta?.data);

                            sanityCountSub++;
                            if (sanityCountSub % 1000 === 0)
                                slog.info("sanityCountSub", {sanityCountSub});
                        }
                    }
                    doneConsuming.resolve(true);
                }
            };
            const consumeTaskDone = consumeTask();

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
                // todo, await delay(50 * numCPUs);
                await delay(eventSpacingMillis);
                Instrumentation.instance.getTimestamps(tagData.identifier!).beforePublish = Date.now();

                //tagDataArray.push(tagData);
                await testRef.publisher?.send(tagData);
                Instrumentation.instance.getTimestamps(tagData.identifier!).afterPublish = Date.now();
                // todo no batching

                sanityCountPub++;
                if (sanityCountPub % 1000 === 0)
                    slog.info("sanityCountPub", {sanityCountPub});
            }
            //await testRef.publisher.sendBatch(tagDataArray); todo no batching

            await doneConsuming.promise;
            await consumeTaskDone;

            slog.info("runLoadTest", {iteration: testValTracker.size, testVal: testValFormat(uuidSubStream, 0)});
        } catch (error) {
            console.error('An error occurred while running the test task:', error);
        }
    });

    await Promise.allSettled(runTestTasks).catch((error) => {
        console.error('An error occurred while running the test tasks:', error);
    });
}

export async function loadTest(kafkaTopicLoad: string, numCPUs: number, groupId: string) {
    await setupKafkaPairs(kafkaTopicLoad, pairs, pairCount, numCPUs, groupId);
    slog.info("runLoadTest.start: " + Date.now().toString());

    const start = Date.now();
    await runLoadTest(pairs, messageCount, numCPUs);
    const elapsed = Date.now() - start;

    const total = pairs.length * messageCount;
    slog.info(`stats:`, {
        elapsed,
        pairs: pairs.length,
        messageCount,
        total,
        event_rate_per_second: total / (elapsed / 1000)
    });
    Instrumentation.instance.dump();
    slog.info("runLoadTest.end: " + Date.now().toString());
    await teardownTest(pairs);

    return sanityCountSub;
}

export const numCPUs = 1;

export async function mainLoadTest() {
    const isOrchestrator = process.env.ORCHESTRATOR === 'true';

    if (isOrchestrator) {
        console.log('This is the orchestrator node');
        return;
    }

    if (env.MEMORY_DB_ENDPOINT_ADDRESS && env.MEMORY_DB_ENDPOINT_ADDRESS.length > 0)
        env.REDIS_HOST = env.MEMORY_DB_ENDPOINT_ADDRESS;
    env.REDIS_PORT = "6379";

    console.log(`numCPUs: ${numCPUs}`);
    const { kafkaTopicLoad, groupId } = generateTopicAndGroupId();

    try {
        if (process.argv[2] !== 'msk-serverless')
            await createAndVerifyKafkaTopic(kafkaTopicLoad);
        const sanityCountSub = await loadTest(kafkaTopicLoad, numCPUs, groupId);
        await delay(10000);
        expect(sanityCountSub).to.equal(pairCount * messageCount);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

mainLoadTest().then(() => {
    console.log(`loadTest, exit main at ${new Date().toISOString()}`);
}).catch((error) => {
    console.error('loadTest, An error occurred:', error);
});
