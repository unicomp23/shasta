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

interface Pairs {
    publisher: Publisher,
    subscriber: Subscriber,
    tagDataObjectIdentifier: TagDataObjectIdentifier
}

describe("End-to-End Load Test", () => {
    let publisher: Publisher;
    let subscriber: Subscriber;
    let worker: Worker;
    let identifier: TagDataObjectIdentifier;
    let nestedTests = 0;

    before(async () => {
        const resources = await setup();
        publisher = resources.publisher;
        subscriber = resources.subscriber;
        worker = resources.worker;
        identifier = resources.identifier;
    });

    after(async () => {
        await teardown(publisher, subscriber, worker);
        expect(nestedTests).to.equal(1);
    });

    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {

        async function setupKafkaPairs(n: number): Promise<Array<Pairs>> {
            const kafka = createKafka(`test-kafka-id-${crypto.randomUUID()}`);

            const pairs: Array<Pairs> = [];

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

                await publisher.connect(); // Connect publisher to Kafka

                pairs.push({publisher, subscriber, tagDataObjectIdentifier});
            }

            return pairs;
        }

        async function runLoadTest(pairs: Pairs[], n: number) {
            const completions = new AsyncQueue<TagDataObjectIdentifier>();
            let count = pairs.length;

            for (const {publisher, subscriber, tagDataObjectIdentifier} of pairs) {

                const threadPubSub = async () => {
                    slog.info('threadPubSub');

                    const threadSub = async() => {
                        slog.info('threadSub');

                        for (let i = 0; i < n; i++) {
                            const tagData = new TagData({
                                identifier: tagDataObjectIdentifier,
                                data: `Test Value: ${i}`,
                            });

                            slog.info(`sending: `, tagData);
                            await publisher.send(tagData); // Send the payload using the publisher
                        }

                        await delay(2000);
                        const messageQueue = await subscriber.stream(); // Subscribe to the stream of messages

                        for (let i = 0; i < n; i++) {
                            const receivedMsg = await messageQueue.get(); // Read message from the subscriber
                            if (receivedMsg.delta === undefined || receivedMsg.delta.data !== `Test Value: ${i}`) {
                                console.error("Invalid message received:", receivedMsg);
                            } else {
                                console.log("Message validated:", receivedMsg);
                            }
                        }
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
            nestedTests++;
        }

        //const n = 1000; // Number of publisher/subscriber pairs
        //const m = 100; // Number of published messages per pair

        const n = 2; // Number of publisher/subscriber pairs
        const m = 2; // Number of published messages per pair
        const pairs = await setupKafkaPairs(n);
        slog.info('runLoadTest');
        await runLoadTest(pairs, m);
    });
});
