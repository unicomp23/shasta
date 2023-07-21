import {slog} from "../logger/slog";
import {createKafka} from "../kafka/createKafka";
import {env} from "process";

export async function createTopics(topic: string): Promise<void> {
    const kafka = createKafka(env.APP || "shasta-app-id");

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
