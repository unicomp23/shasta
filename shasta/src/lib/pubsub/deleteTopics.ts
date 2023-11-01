import {createKafka} from "../kafka/createKafka";
import {slog} from "../logger/slog";
import {delay} from "@esfx/async";
import crypto from "crypto";
import { RedisKeyCleanup } from './redisKeyCleanup';

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

async function main() {
    deleteTestTopics();
    const cleaner = new RedisKeyCleanup();
    cleaner.deleteAllKeys()
        .then(() => cleaner.disconnect())
        .catch(console.error);
}

main().then(() => {
    console.log('deleteTestTopics, exit main');
}).catch((error) => {
    console.error('deleteTestTopics, An error occurred:', error);
});
