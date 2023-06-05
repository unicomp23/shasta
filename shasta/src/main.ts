import {publisher} from "../tests/integ/kafka/publisher";
import {Deferred, delay} from "@esfx/async";
import {AsyncDisposableStack} from "@esfx/disposable";
import {consumer_group_worker} from "./lib/kafka/consumer_group_worker";
import {config, createTopics} from "./lib/config";

async function main() {
    const disposable_stack = new AsyncDisposableStack();
    const quit = new Deferred<boolean>();
    try {
        const config_ = (await config.create());
        await createTopics(config_);

        const worker_subscriber_ = consumer_group_worker.create(config_);
        disposable_stack.use(worker_subscriber_);
        await worker_subscriber_.connect();
        while (!worker_subscriber_.is_joined())
            await delay(1000);

        for(;;) {
            await delay(1000);
            // todo, fire quit on some signal from app (ie kill, a shutdown message, etc)
        }
    } catch (e) {
        console.error(`main:`, e);
    } finally {
        await disposable_stack.disposeAsync();
        quit.resolve(true);
    }
}

main().then(() => {
    console.log("main exit")
});
