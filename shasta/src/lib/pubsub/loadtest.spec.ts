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

const n = 2; // Number of publisher/subscriber pairs
const m = 2; // Number of published messages per pair

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
        expect(sanityCount).to.equal(pairs.length * n);
    });

    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {
        await setupKafkaPairs(pairs, n);
        slog.info("runLoadTest");
        await runLoadTest(pairs, m);
    });
});

async function setupKafkaPairs(pairs: TestRef[], n: number): Promise<void> {
    const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);

    for (let i = 0; i < n; i++) {
        const testRef = await setup();
        pairs.push(testRef);
    }
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

async function teardown(pairs: TestRef[]) {
    for (const testRef of pairs) {
        await testRef.worker.shutdown();
        await testRef.publisher.disconnect();
        await testRef.subscriber.disconnect();
    }
}

async function runLoadTest(pairs: TestRef[], n: number) {
    const completions = new AsyncQueue<TagDataObjectIdentifier>();

    const tasks = pairs.map(({ publisher, subscriber, tagDataObjectIdentifier }) => {
        return (async () => {
            const messageQueue = await subscriber.stream();
            await delay(2000);

            for (let i = 0; i < n; i++) {
                const tagData = new TagData({
                    identifier: tagDataObjectIdentifier,
                    data: `Test Value: ${i}`,
                });
                await publisher.send(tagData);
            }

            for (let i = 0; i < n; i++) {
                const receivedMsg = await messageQueue.get();
                if (receivedMsg.delta === undefined || receivedMsg.delta.data !== `Test Value: ${i}`) {
                    slog.info("Invalid message received:", receivedMsg);
                } else {
                    slog.info("Message validated:", receivedMsg);
                    sanityCount++;
                }
            }

            completions.put(tagDataObjectIdentifier);
        })();
    });

    await Promise.all(tasks);
}
