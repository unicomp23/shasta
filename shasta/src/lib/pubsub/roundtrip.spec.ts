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
    const worker = await Worker.create(kafka, groupId, kafkaTopic);
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

describe("End-to-End Test", () => {
    let publisher: Publisher;
    let subscriber: Subscriber;
    let worker: Worker;
    let identifier: TagDataObjectIdentifier;
    let count = 0;

    before(async () => {
        const resources = await setup();
        publisher = resources.publisher;
        subscriber = resources.subscriber;
        worker = resources.worker;
        identifier = resources.identifier;
    });

    after(async () => {
        await teardown(publisher, subscriber, worker);
        expect(count).to.equal(snapCount + deltaCount);
    });

    it("should process messages from Publisher to Worker via Redis Subscriber", async () => {
        const tagData = new TagData();
        tagData.identifier = identifier.clone();
        tagData.data = "Test Value snapshot";

        await publisher.send(tagData);

        await waitFor(2000);

        const snapshotsQueue = await subscriber.stream();

        const message = await snapshotsQueue.get();

        const snapshot = message.snapshot;
        expect(snapshot).to.exist;
        expect(snapshot!.snapshot[identifier.name!].tagData!.data).to.equal(tagData.data);
        count++;

        for (let i = 0; i < deltaCount; i++) {
            const tagDataDelta = new TagData();
            tagDataDelta.identifier = identifier.clone();
            tagDataDelta.data = `Test Delta Value: ${i}`;
            await publisher.send(tagDataDelta);

            const deltaMessage = await snapshotsQueue.get();

            const delta = deltaMessage.delta;
            expect(delta).to.exist;
            expect(delta?.data).to.equal(tagDataDelta.data);
            count++;
        }
    });
});

// todo recover redis connection (ie tcp send fail)
// todo recover kafka connection (ie tcp send fail)
// todo detect publisher absent due to missing heartbeat
// todo redis ping/pong
// todo kafka worker ping/pong
