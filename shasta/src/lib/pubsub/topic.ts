// shasta/shasta/src/lib/pubsub/topic.ts
import { Kafka, ITopicConfig, ITopicMetadata } from "kafkajs";
import { slog } from "../logger/slog";
import { createKafka } from "../kafka/createKafka";
import { env } from "process";
import { delay } from "@esfx/async";
import crypto from "crypto";

export async function createAndVerifyKafkaTopic(kafkaTopicLoad: string): Promise<void> {
    const kafka = await createKafka(env.APP || "shasta-app-id");
    const admin = kafka.admin();

    const topicConfig: ITopicConfig = {
        topic: kafkaTopicLoad,
        numPartitions: 256,
    };

    try {
        await admin.connect();

        await admin.createTopics({
            topics: [topicConfig],
        });

        // Repeatedly check if the topic has been created.
        let topicExists = false;
        const timeoutMs = 10000; // Increase to 10 seconds
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
            } catch (error) {
                slog.error('An error occurred while waiting for the topic to be created:', error);
                throw error; // Add this line
            }
        }

        slog.info("All topics have been created");
    } catch (error) {
        slog.error("Error creating topics:", error);
    } finally {
        try {
            await admin.disconnect();
            slog.info("Cleaned up admin client");
        } catch (error) {
            slog.error("Error cleaning up admin client:", error);
        }
    }
}

// Helper function to find the topic in the topic metadata object.
function findTopicInMetadata(topic: string, metadata: ITopicMetadata[]): boolean {
    return metadata.some((topicMetadata: ITopicMetadata) => topicMetadata.name === topic);
}

export async function createTopics(topic: string): Promise<void> {
    const kafka = await createKafka(env.APP || "shasta-app-id");

    const admin = kafka.admin();

    const requiredTopics = [
        topic
    ];

    try {
        await admin.connect();

        await admin.createTopics({
            topics: requiredTopics.map((topicName) => ({
                topic: topicName,
            })),
            waitForLeaders: true,
        });

        slog.info("All topics have been created");
    } catch (error) {
        slog.error("Error creating topics:", error);
    } finally {
        try {
            await admin.disconnect();
            slog.info("Cleaned up admin client");
        } catch (error) {
            slog.info("Error cleaning up admin client:", error);
        }
    }
}

export function generateTopicAndGroupId(): { kafkaTopicLoad: string, groupId: string } {
    //todo const randomTag: string = crypto.randomUUID();
    const randomTag = "189";

    const kafkaTopicLoad = `test_topic_load-${randomTag}`;
    const groupId = `test_group_id-${randomTag}`;

    return { kafkaTopicLoad, groupId };
}
