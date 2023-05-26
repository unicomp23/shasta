import crypto from "crypto";
import {AsyncDisposable} from "@esfx/disposable";
import {config} from "../config";
import {createKafka} from "../../../tests/integ/common/createKafka";

export class consumer_group_worker {
    private readonly runner_ = (async () => {
        // Subscribe to the worker topic
        await this.consumer.subscribe({
            topic: this.config_.easy_pubsub.get_worker_topic(),
            fromBeginning: false,
        })

        // Run the consumer and process each received message
        await this.consumer.run({
            eachMessage: async ({topic, partition, message}) => {
                // todo: process message
                console.log(message.value!.toString());
            },
        })
        return true;
    })();
    private joined = false;

    private constructor(
        private readonly config_: config,
        readonly topic = config_.easy_pubsub.get_worker_topic(),
        private readonly kafka = createKafka(config_.easy_pubsub.get_app_id() + '/client_id/' + crypto.randomUUID()),
        private readonly consumer = kafka.consumer({
            groupId: config_.easy_pubsub.get_worker_group_id(),
        }),
    ) {
        consumer.on(consumer.events.FETCH_START, async () => {
            this.joined = true;
        });
    }

    public static create(config_: config) {
        return new consumer_group_worker(config_);
    }

    public async connect() {
        await this.consumer.connect()
    }

    public is_joined() {
        return this.joined;
    }

    async [AsyncDisposable.asyncDispose]() {
        await this.consumer.stop();
        await this.consumer.disconnect();
    }
}
