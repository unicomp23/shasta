import {Kafka} from "kafkajs";
import {kafkaLogLevel} from "./constants";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {env} from "process";

export function createKafka(clientId: string, region: string = 'us-east-1', numCPUs = 1): Kafka {
    const bootstrapEndpoints = env.KAFKA_BROKERS?.split(",") || [];
    /*
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
    return new Kafka({
        clientId: 'my-app',
        brokers: ['seed-374cea23.cjfoit0ccm8eecla1s60.fmc.prd.cloud.redpanda.com:9092'],
        // authenticationTimeout: 10000,
        // reauthenticationThreshold: 10000,
        ssl: true,
        sasl: {
            mechanism: 'scram-sha-256',
            username: 'jdavis',
            password: env.REDPANDA_SASL_PASSWORD || ''
        },
        retry: {
            initialRetryTime: 200 * numCPUs,
            retries: 8
        }
    });
}
