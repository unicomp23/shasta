import crypto from "crypto";
import {AirCoreFrame} from "../proto/gen/devinternal_pb";
import {AsyncQueue} from "@esfx/async";
import {AsyncDisposable} from "@esfx/disposable";
import {config} from "../config";
import {partition_tracking} from "./partition_tracking";
import {createKafka} from "../../../src/lib/kafka/createKafka";

export class worker_subscriber {
    public readonly partition_tracking_ = partition_tracking.create();
    public readonly frames = new AsyncQueue<AirCoreFrame>();

    // Create a private property `runner_` to run the consumer logic
    private readonly runner_ = (async () => {
        // Listen to group join events to update partition information
        this.partition_tracking_.group_join(this.consumer, this.topic);

        // Subscribe to the worker topic
        await this.consumer.subscribe({
            topic: this.config_.easy_pubsub.get_worker_topic(),
            fromBeginning: false,
        })

        // Run the consumer and process each received message
        await this.consumer.run({
            eachMessage: async ({topic, partition, message}) => {
                const frame = AirCoreFrame.fromBinary(message.value!);
                this.frames.put(frame);
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
        return new worker_subscriber(config_);
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

    private async partitions_active() {
        await this.partition_tracking_.partitions_to_active();
    }
}

/*
The `worker_subscriber` class serves to consume messages from a worker topic and put them into the `frames` AsyncQueue.
It uses partition_tracking to keep track of the partitions in the consumer group, and subscribes to the topic
based on the configuration provided. Upon subscribing and connecting the consumer, it processes each received message,
converting the message value to an AirCoreFrame and adding it to the frames queue. The class also includes some utility
methods, such as isConnected and connect, to manage the consumer connection and a dispose method to handle clean up upon disposal.
 */
