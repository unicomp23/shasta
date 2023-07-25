import {ITopicConfig} from "kafkajs";
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {Publisher} from "./publisher";
import {Subscriber} from "./subscriber";
import {Worker} from "./worker";
import {createKafka} from "../kafka/createKafka";
import crypto from "crypto";
import {envVarsSync} from "../../automation";
import {expect} from "chai";
import {after, before, describe, it} from "mocha";
import {Kafka} from "kafkajs";
import {AsyncQueue} from "@esfx/async-queue";
import {slog} from "../logger/slog";
import {Deferred, delay} from "@esfx/async";


envVarsSync();

const kafkaTopic = `test_topic-${crypto.randomUUID()}`;

const snapCount = 1;
const deltaCount = 3;

async function waitFor(durationInMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

async function setup() {
    const identifier = new TagDataObjectIdentifier();
    identifier.appId = `some-app-id-${crypto.randomUUID()}`;
    identifier.tag = `tag-id-${crypto.randomUUID()}`;
    identifier.scope = `scope-id-${crypto.randomUUID()}`;
    identifier.name = `name-${crypto.randomUUID()}`;

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

    const subscriber = new Subscriber(identifier);

    const groupId = `test-group-id-${crypto.randomUUID()}`;
    const worker = new Worker(kafka, groupId, kafkaTopic);
    await worker.groupJoined();

    return {
        publisher,
        subscriber,
        worker,
        identifier
    };
}

async function teardown(publisher: Publisher, subscriber: Subscriber, worker: Worker) {
    await worker.shutdown();
    await publisher.disconnect();
    await subscriber.disconnect();
}

interface TestRef {
    publisher: Publisher,
    subscriber: Subscriber,
    worker: Worker,
    tagDataObjectIdentifier: TagDataObjectIdentifier
}

describe("End-to-End Load Test", () => {
    let sanityCount = 0;
    const testRefs: Array<TestRef> = [];

    before(async () => {
        expect(sanityCount).to.equal(0);
    });

    after(async () => {
        for(const testRef of testRefs) {
            await teardown(testRef.publisher, testRef.subscriber, testRef.worker);
        }
        expect(sanityCount).to.equal(1);
    });

    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {

        async function setupTestRefs(n: number): Promise<void> {
            const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);

            for (let i = 0; i < n; i++) {
                const tagDataObjectIdentifier = new TagDataObjectIdentifier({
                    appId: `app-id-${crypto.randomUUID()}`,
                    tag: `tag-id-${crypto.randomUUID()}`,
                    scope: `scope-id-${crypto.randomUUID()}`,
                    name: `name-${crypto.randomUUID()}`,
                });

                const publisher = new Publisher(kafka, kafkaTopic);
                const subscriber = new Subscriber(tagDataObjectIdentifier);
                slog.info('new Subscriber', tagDataObjectIdentifier);
                const worker = new Worker(kafka, `test-group-id-${crypto.randomUUID()}`, kafkaTopic);

                await publisher.connect(); // Connect publisher to Kafka

                testRefs.push({publisher, subscriber, worker, tagDataObjectIdentifier});
            }
        }

        async function runLoadTest(n: number) {
            const completions = new AsyncQueue<TagDataObjectIdentifier>();
            let count = testRefs.length;

            for (const {publisher, subscriber, tagDataObjectIdentifier} of testRefs) {

                const threadPubSub = async () => {
                    slog.info('threadPubSub');

                    const threadSub = async() => {
                        slog.info('threadSub');

                        // Stream messages from Redis
                        const messageQueue = await subscriber.stream(); // Subscribe to the stream of messages
                        await delay(2000);

                        // Send messages to Kafka
                        for (let i = 0; i < n; i++) {
                            const tagData = new TagData({
                                identifier: tagDataObjectIdentifier,
                                data: `Test Value: ${i}`,
                            });

                            slog.info(`sending: `, tagData);
                            await publisher.send(tagData); // Send the payload using the publisher
                        }

                        // empty snapshot, then deltas

                        // Validate messages from Redis
                        for (let i = 0; i < n; i++) {
                            const receivedMsg = await messageQueue.get(); // Read message from the subscriber
                            if (receivedMsg.delta === undefined || receivedMsg.delta.data !== `Test Value: ${i}`) {
                                slog.info("Invalid message received:", receivedMsg);
                            } else {
                                slog.info("Message validated:", receivedMsg);
                            }
                        }

                        // Send completion
                        completions.put(tagDataObjectIdentifier);
                        slog.info(`completion enqueued: `, tagDataObjectIdentifier);
                    };
                    const notUsed = threadSub();

                } // thread
                const notUsed = threadPubSub();
            }
            while (count > 0) {
                const tagDataObjIdentifier = await completions.get();
                slog.info(`completion dequeued: `, tagDataObjIdentifier)
                count--;
            }
            sanityCount++;
        }

        //const n = 1000; // Number of publisher/subscriber pairs
        //const m = 100; // Number of published messages per pair

        const n = 2; // Number of publisher/subscriber pairs
        const m = 2; // Number of published messages per pair
        await setupTestRefs(n);

        slog.info('runLoadTest');
        await runLoadTest(m);
    });
});
