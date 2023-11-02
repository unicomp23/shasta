import {Deferred, delay} from "@esfx/async";
import {createKafka} from "./lib/kafka/createKafka";
import {Worker} from "./lib/pubsub/worker";
import {env} from "process";
import {createTopics} from "./lib/pubsub/topic";

async function main() {
    const quit = new Deferred<boolean>();
    let worker: Worker | null = null;
    try {
        await createTopics("tag-data");

        const kafka = await createKafka(env.APP_ID || "shasta-app-id");
        worker = await Worker.create(kafka,
            env.CONSUMER_GROUP_ID || "tag-data-consumer-group-id",
            env.KAFKA_TOPIC || "tag-data");
        while (!await worker.groupJoined())
            await delay(1000);

        for (; ;) {
            await delay(1000);
            // todo, fire quit on some signal from app (ie kill, a shutdown message, etc)
        }
    } catch (e) {
        console.error(`main:`, e);
    } finally {
        if(worker)
            await worker.shutdown();
        quit.resolve(true);
    }
}

main().then(() => {
    console.log("main exit")
});
