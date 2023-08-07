import {Kafka} from "kafkajs";
import {kafkaLogLevel} from "./constants";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {env} from "process";

export function createKafka(clientId: string, region: string = 'us-east-1'): Kafka {
    /*const bootstrapEndpoints = env.KAFKA_BROKERS?.split(",") || [];
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
    }*/
    const bootstrapEndpoints = ["seed-786754f2.cj6iplqr6237gqb2l7n0.fmc.prd.cloud.redpanda.com:9092"];
    return new Kafka({
        clientId: 'my-app',
        brokers: ['seed-786754f2.cj6iplqr6237gqb2l7n0.fmc.prd.cloud.redpanda.com:9092'],
        // authenticationTimeout: 10000,
        // reauthenticationThreshold: 10000,
        ssl: true,
        sasl: {
            mechanism: 'scram-sha-256',
            username: 'jdavis',
            password: env.REDPANDA_SASL_PASSWORD || ''
        },
    });
}
