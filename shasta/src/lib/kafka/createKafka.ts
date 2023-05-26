import {Kafka} from "kafkajs";
import {env} from "process";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {kafkaLogLevel} from "./constants";

export function createKafka(clientId: string, region: string = 'us-east-1'): Kafka {
    console.log("createKafka: env.KAFKA_BROKERS: ", env.KAFKA_BROKERS);
    return new Kafka({
        clientId,
        brokers: env.KAFKA_BROKERS?.split(',') || [],
        logLevel: kafkaLogLevel,
        ssl: true,
        sasl: createMechanism({region}),
    });
}
