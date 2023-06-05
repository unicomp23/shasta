import {Partitioners, ProducerRecord} from "kafkajs";
import * as crypto from "crypto";
import {AirCoreFrame} from "../proto/gen/devinternal_pb";
import {AsyncDisposable} from "@esfx/disposable";
import {config} from "../config";
import {createKafka} from "../../../src/lib/kafka/createKafka";

export enum topic_type {
    unknown,
    worker,
    reply_to,
}

export class publisher {
    private readonly topic_worker: string;
    private readonly topic_reply_to: string;
    private connected = false;

    private constructor(
        private readonly config_: config,
        private readonly kafka = createKafka(config_.easy_pubsub.get_app_id() + '/' + crypto.randomUUID()),
        private readonly producer = kafka.producer({
            allowAutoTopicCreation: true,
            createPartitioner: Partitioners.DefaultPartitioner,
        })
    ) {
        this.topic_worker = config_.easy_pubsub.get_worker_topic();
        this.topic_reply_to = config_.easy_pubsub.get_reply_to_topic();
    }

    // Static create method for creating a new publisher instance
    public static create(config_: config) {
        return new publisher(config_);
    }

    // Gets the corresponding topic string based on the topic_type enum value
    public get_topic(topic_type_: topic_type) {
        switch (topic_type_) {
            case topic_type.reply_to:
                return this.topic_reply_to;
            case topic_type.worker:
                return this.topic_worker;
            default:
                throw new Error(`unhandled topic_type: ${topic_type_}`);
        }
    }

    // Sends a given AirCoreFrame message to the specified topic_type
    public async send(topic_type_: topic_type, frame: AirCoreFrame) {
        if (!this.connected) {
            await this.producer.connect();
            this.connected = true;
        }
        const topic = this.get_topic(topic_type_);
        const record = {
            topic: topic,
            messages: [{
                value: Buffer.from("")
            }]
        } as ProducerRecord;

        // Sets the appropriate partition and key information based on the topic_type
        switch (topic_type_) {
            case topic_type.worker: {
                if (frame.sendTo?.kafkaKey?.kafkaPartitionKey?.x.case == "sequenceNumberPath")
                    record.messages[0].key = Buffer.from(frame.sendTo?.kafkaKey?.kafkaPartitionKey?.x.value.toBinary());
                else
                    throw new Error(`missing frame.sendTo?.kafkaKey?.kafka_partition_key?x.case:"sequence_number_path"`);
                break;
            }
            case topic_type.reply_to: {
                if (frame.replyTo?.kafkaKey?.kafkaPartitionKey?.x.case == "partitionInteger")
                    record.messages[0].partition = frame.replyTo?.kafkaKey?.kafkaPartitionKey?.x.value | 0;
                else throw new Error(`missing frame.reply_to?.kafka_key?.kafka_partition_key?.x.case:"partition_integer"`);
                break;
            }
            default:
                throw new Error(`unhandled: ${topic_type_}`);
        }
        record.messages[0].value = Buffer.from(frame.toBinary());
        await this.producer.send(record);
    }

    // Implements the asyncDispose method for clean disposal of the publisher object
    async [AsyncDisposable.asyncDispose]() {
        await this.producer.disconnect();
    }
}

/*
The `publisher` class:

1. Publishes messages to either the `worker` or `reply_to` topics based on the specified topic type
2. Connects to the Kafka broker and initializes the Kafka producer with the appropriate partitioner and topic creation setting
3. Sets the partition and key information based on the topic_type before sending the message
4. Implements the asyncDispose method for clean disposal of the publisher object
 */