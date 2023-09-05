import {Kafka, KafkaMessage, Producer} from 'kafkajs';
import {TagData} from "../../../submodules/src/gen/tag_data_pb";
import {slog} from "../logger/slog";

// Convert message to a buffer
class Publisher {
    private producer: Producer;

    constructor(kafka: Kafka, readonly topic: string) {
        this.producer = kafka.producer({
            maxInFlightRequests: 20,
            idempotent: true,
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });
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
    public async sendBatch(tagDatas: TagData[]): Promise<void> {
        try {
            const messages = new Array<KafkaMessage>();
            for(const tagData of tagDatas) {
                if (tagData.identifier === undefined) {
                    slog.error("TagData identifier is undefined");
                    return;
                }

                // Prepare Kafka message
                const tagDataIdentifierPartition = tagData.identifier.clone();
                const message = {
                    value: Buffer.from(tagData.toBinary()),
                    key: Buffer.from(tagDataIdentifierPartition.toBinary()),
                } as KafkaMessage;

                messages.push(message);
            }

            // Send messages
            await this.producer.send({
                topic: this.topic,
                messages,
                acks: 1,
            });

            //slog.info("Messages published successfully");
        } catch (error) {
            slog.error(`Failed to publish the message: : `, error);
        }
    }

    public async send(tagData: TagData): Promise<void> {
        // call sendBatch
        await this.sendBatch([tagData]);
    }
}

export {Publisher};
