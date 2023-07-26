import {Kafka, Producer} from 'kafkajs';
import {TagData} from "../../../submodules/src/gen/tag_data_pb";
import {slog} from "../logger/slog";

// Convert message to a buffer
const encode = (message: TagData): Buffer => {
    return Buffer.from(message.toBinary());
};

class Publisher {
    private producer: Producer;

    constructor(kafka: Kafka, readonly topic: string) {
        this.producer = kafka.producer();
    }

    // Connect to Kafka producer
    public async connect(): Promise<void> {
        try {
            await this.producer.connect();
            slog.info('Connected to Kafka producer successfully');
        } catch (error) {
            slog.error(`Failed to connect to the producer: `, error);
        }
    }

    // Disconnect from Kafka producer
    public async disconnect(): Promise<void> {
        try {
            await this.producer.disconnect();
            slog.info("Disconnected from Kafka producer successfully");
        } catch (error) {
            slog.error(`Failed to disconnect from the producer: `, error);
        }
    }

    // Send TagData message to Kafka topic
    public async send(tagData: TagData): Promise<void> {
        try {
            if (tagData.identifier === undefined) {
                slog.error("TagData identifier is undefined");
                return;
            }

            // Prepare Kafka message
            const tagDataIdentifierPartition = tagData.identifier.clone();
            tagDataIdentifierPartition.name = "";
            const message = {
                value: encode(tagData),
                key: Buffer.from(tagDataIdentifierPartition.toBinary()),
            };

            // Send message
            await this.producer.send({
                topic: this.topic,
                messages: [message],
            });

            slog.info("Message published successfully");
        } catch (error) {
            slog.error(`Failed to publish the message: : `, error);
        }
    }
}

export {Publisher};
