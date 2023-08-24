import {Kafka, logLevel} from "kafkajs";
import {kafkaLogLevel} from "./constants";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {env} from "process";

export const singleServerTcpSpacingMillis = 100;

export function createKafka(clientId: string, region: string = 'us-east-1', numCPUs = 1): Kafka {
    const bootstrapEndpoints = ["b-1.shastamskautomation78.znsa2v.c21.kafka.us-east-1.amazonaws.com:9092","b-2.shastamskautomation78.znsa2v.c21.kafka.us-east-1.amazonaws.com:9092","b-3.shastamskautomation78.znsa2v.c21.kafka.us-east-1.amazonaws.com:9092"];
    if (true) {
        return new Kafka({
            clientId,
            brokers: bootstrapEndpoints,
            logLevel: logLevel.DEBUG,
            logCreator: logLevel => {
                return ({ namespace, level, label, log }) => {
                    const { message, ...others } = log
                    console.log(`[${label}] ${namespace} - ${message}`, others)
                }
            },
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
    /*
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
            initialRetryTime: singleServerTcpSpacingMillis * numCPUs,
            retries: 8
        }
    });*/
}
