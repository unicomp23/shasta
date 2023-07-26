import { ITopicConfig } from "kafkajs";
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
import { after, before, describe, it } from "mocha";
import { AsyncQueue } from "@esfx/async-queue";
import { slog } from "../logger/slog";
import { delay } from "@esfx/async";

envVarsSync();

const pairCount = 2; // Number of publisher/subscriber pairs
const messageCount = 2; // Number of published messages per pair

const kafkaTopic = `test_topic-${crypto.randomUUID()}`;
let sanityCount = 0;

interface TestRef {
    publisher: Publisher;
    subscriber: Subscriber;
    worker: Worker;
    tagDataObjectIdentifier: TagDataObjectIdentifier;
}

describe("End-to-End Load Test", () => {
    const pairs = new Array<TestRef>();

    before(async () => {
        expect(sanityCount).to.equal(0);
    });

    after(async () => {
        await teardown(pairs);
        expect(sanityCount).to.equal(pairCount * messageCount);
    });

    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {
        await setupKafkaPairs(pairs, pairCount);
        slog.info("runLoadTest");
        await runLoadTest(pairs, messageCount);
    });
});

async function setupKafkaPairs(pairs: TestRef[], n: number): Promise<void> {
    // Create an array of tasks for setting up each pair
    const setupTasks = Array.from({ length: n }, () => setup());

    // Use Promise.all to wait for all the pairs to be set up in parallel
    const setupResults = await Promise.all(setupTasks);

    // Add the results to the "pairs" array
    pairs.push(...setupResults);

    slog.info("setupKafkaPairs", { pairs: pairs.length });
}

async function teardown(pairs: TestRef[]) {
    const tasks = pairs.map(async ({ worker, publisher, subscriber }) => {
        await worker.shutdown();
        await publisher.disconnect();
        await subscriber.disconnect();
    });

    await Promise.all(tasks);
}

async function setup(): Promise<TestRef> {
    const tagDataObjectIdentifier = new TagDataObjectIdentifier();
    tagDataObjectIdentifier.appId = `some-app-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.tag = `tag-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.scope = `scope-id-${crypto.randomUUID()}`;
    tagDataObjectIdentifier.name = `name-${crypto.randomUUID()}`;

    const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);
    const admin = kafka.admin();
    await admin.connect();
    const topicConfig: ITopicConfig = {
        topic: kafkaTopic,
        numPartitions: 3,
    };
    await admin.createTopics({
        topics: [topicConfig],
    });
    await admin.disconnect();

    const publisher = new Publisher(kafka, kafkaTopic);
    await publisher.connect();

    const subscriber = new Subscriber(tagDataObjectIdentifier);

    const groupId = `test-group-id-${crypto.randomUUID()}`;
    const worker = new Worker(kafka, groupId, kafkaTopic);
    await worker.groupJoined();

    return {
        publisher,
        subscriber,
        worker,
        tagDataObjectIdentifier,
    };
}

async function runLoadTest(pairs: TestRef[], m: number) {
    const completions = new AsyncQueue<TagDataObjectIdentifier>();

    // Create an array of tasks for each pair
    const tasks = pairs.map(async (testRef) => {
        const uuidSubStream = crypto.randomUUID();
        const testVal = (uuid: string, counter: number) => `Test Value: ${uuid}, ${counter}`;

        await testRef.worker.groupJoined();
        const messageQueue = await testRef.subscriber.stream();

        // Sending messages
        const sendTasks = Array.from({ length: m }, (_, i) => {
            const tagData = new TagData({
                identifier: testRef.tagDataObjectIdentifier,
                data: testVal(uuidSubStream, i),
            });
            return testRef.publisher.send(tagData);
        });
        await Promise.all(sendTasks);

        const snapshot = await messageQueue.get();
        expect(snapshot.snapshot).to.not.be.undefined;

        // Receiving and checking messages
        const receiveTasks = Array.from({ length: m }, async (_, i) => {
            const receivedMsg = await messageQueue.get();
            expect(receivedMsg.delta).to.not.be.undefined;
            expect(testVal(uuidSubStream, i)).to.equal(receivedMsg.delta?.data);
            sanityCount++;
        });
        await Promise.all(receiveTasks);

        completions.put(testRef.tagDataObjectIdentifier);
    });

    await Promise.all(tasks);
}
