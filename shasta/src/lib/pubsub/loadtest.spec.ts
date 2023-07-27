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

const kafkaTopicLoad = `test_topic_load-${crypto.randomUUID()}`;
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
    for (let i = 0; i < n; i++) {
        const testRef = await setup();
        pairs.push(testRef);
    }
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
        topic: kafkaTopicLoad,
    };
    await admin.createTopics({
        topics: [topicConfig],
    });
    await admin.disconnect();

    const publisher = new Publisher(kafka, kafkaTopicLoad);
    await publisher.connect();

    const subscriber = new Subscriber(tagDataObjectIdentifier);

    const groupId = `test-group-id-${crypto.randomUUID()}`;
    const worker = new Worker(kafka, groupId, kafkaTopicLoad);
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

    for(const testRef of pairs) {
        if(testRef.tagDataObjectIdentifier.name === "" || testRef.tagDataObjectIdentifier.name === undefined) {
            throw new Error("TagDataObjectIdentifier name is empty");
        }

        const uuidSubStream = crypto.randomUUID();
        const testValFormat = (uuid: string, counter: number) => `Load test Value: ${uuid}, ${counter}`;
        const testValTracker = new Set<string>();

        await testRef.worker.groupJoined();
        const messageQueue = await testRef.subscriber.stream();

        for (let i = 0; i < m; i++) {
            const testVal = testValFormat(uuidSubStream, i);
            const tagData = new TagData({
                identifier: testRef.tagDataObjectIdentifier,
                data: testVal,
            });
            testValTracker.add(testVal);
            await testRef.publisher.send(tagData);
        }

        const snapshot = await messageQueue.get();
        expect(snapshot.snapshot).to.not.be.undefined;

        for (;;) {
            const receivedMsg = await messageQueue.get();
            expect(receivedMsg.delta).to.not.be.undefined;
            if(receivedMsg.delta?.data) testValTracker.delete(receivedMsg.delta?.data);
            sanityCount++;
            if (testValTracker.size === 0) break;
        }

        completions.put(testRef.tagDataObjectIdentifier);
    }
}
