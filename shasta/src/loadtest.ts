import { Kafka } from "kafkajs";
import crypto from "crypto";
import { Publisher } from "./lib/pubsub/publisher";
import { Subscriber } from "./lib/pubsub/subscriber";
import {TagData, TagDataObjectIdentifier} from "../submodules/src/gen/tag_data_pb";
import {AsyncQueue} from "@esfx/async-queue";
import {slog} from "./lib/logger/slog";

async function createTopic(topic: string, numPartitions: number, kafka: Kafka) {
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
        topics: [
            {
                topic: topic,
                numPartitions: numPartitions,
            },
        ],
    });
    await admin.disconnect();
}

async function setupKafkaPairs(n: number): Promise<Array<{ publisher: Publisher; subscriber: Subscriber }>> {
    const kafka = new Kafka({
        clientId: `load-test-client-${crypto.randomUUID()}`,
        brokers: ["localhost:9092"], // Update this with your broker's address.
    });

    const pairs = [];

    for (let i = 0; i < n; i++) {
        const uuid = crypto.randomUUID();
        const topic = `test-topic-${uuid}`;

        await createTopic(topic, 100, kafka);

        const identifier = new TagDataObjectIdentifier({
            appId: `app-id-${uuid}`,
            tag: `tag-id-${uuid}`,
            scope: `scope-id-${uuid}`,
            name: `name-${uuid}`,
        });

        const publisher = new Publisher(kafka, topic);
        const subscriber = new Subscriber(identifier);

        await publisher.connect(); // Connect publisher to Kafka

        pairs.push({ publisher, subscriber });
    }

    return pairs;
}

async function runLoadTest(pairs: { publisher: Publisher; subscriber: Subscriber }[], n: number) {
    const completions = new AsyncQueue<TagDataObjectIdentifier>();
    let count = pairs.length;

    for (const { publisher, subscriber } of pairs) {
        const messages = [];

        const thread = async () => {
            for (let i = 0; i < n; i++) {
                const tagData = new TagData({
                    identifier: subscriber.getTagDataObjIdentifier(),
                    data: `Test Value: ${i}`,
                });

                await publisher.send(tagData); // Send the payload using the publisher
                messages.push(tagData);
            }

            const messageQueue = await subscriber.stream(); // Subscribe to the stream of messages

            for (let i = 0; i < n; i++) {
                const receivedMsg = await messageQueue.get(); // Read message from the subscriber
                if (receivedMsg.delta === undefined || receivedMsg.delta.data !== `Test Value: ${i}`) {
                    console.error("Invalid message received:", receivedMsg);
                } else {
                    console.log("Message validated:", receivedMsg);
                }
            }
            completions.put(subscriber.getTagDataObjIdentifier());
        } // thread
        const notUsed = thread();
    }
    while(count > 0) {
        const tagDataObjIdentifier = await completions.get();
        slog.info(`completion: `, tagDataObjIdentifier)
        count--;
    }
}

(async () => {
    const n = 1000; // Number of publisher/subscriber pairs
    const m = 100; // Number of published messages per pair
    const pairs = await setupKafkaPairs(n);
    await runLoadTest(pairs, m);
})();