import { Kafka, Producer } from 'kafkajs';
import {TagData, TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";

// Convert message to a buffer
const encode = (message: TagData): Buffer => {
    return Buffer.from(message.toBinary());
};

class Publisher {
    private producer: Producer;

    constructor(kafka: Kafka, readonly topic: string) {
        this.producer = kafka.producer();
    }

    public async connect(): Promise<void> {
        try {
            await this.producer.connect();
            console.log("Connected to Kafka producer successfully")
        } catch (error) {
            console.error('Failed to connect to producer', error);
        }
    }

    public async disconnect() : Promise<void> {
        try {
            await this.producer.disconnect();
            console.log("Disconnected from Kafka producer successfully")
        } catch (error) {
            console.error('Failed to disconnect producer', error);
        }
    }

    public async send(tagDataObjectIdentifier: TagDataObjectIdentifier, tagData: TagData): Promise<void> {
        try {
            // Prepare Kafka message
            const message = {
                value: encode(tagData),
                key: Buffer.from(tagDataObjectIdentifier.toBinary()),
            };

            // Send message
            await this.producer.send({
                topic: this.topic,
                messages: [message],
            });

            console.log("Message published successfully")
        } catch (error) {
            console.error('Failed to publish message', error);
        }
    }
}
