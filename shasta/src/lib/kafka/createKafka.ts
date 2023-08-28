import {Kafka, logLevel} from "kafkajs";
import {kafkaLogLevel} from "./constants";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {env} from "process";

export const singleServerTcpSpacingMillis = 100;

export function createKafka(clientId: string, region: string = 'us-east-1', numCPUs = 1): Kafka {
    const bootstrapEndpoints = env.KAFKA_BROKERS?.split(",") || [];
    if (env.NOTLS) {
        return new Kafka({
            clientId,
            brokers: bootstrapEndpoints,
            logLevel: kafkaLogLevel,
        });
    } else {
        return new Kafka({
            clientId,
            brokers: bootstrapEndpoints,
            logLevel: kafkaLogLevel,
            ssl: true,
            sasl: createMechanism({region}),
        });
    }
}
