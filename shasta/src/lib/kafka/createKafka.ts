import {Kafka} from "kafkajs";
import {kafkaLogLevel} from "./constants";
import {env} from "process";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {configFileFactory} from "../config";

export function createKafka(clientId: string, region: string = 'us-east-1'): Kafka {
    const configFile = configFileFactory();
    console.log("createKafka: ", configFile);
    const plainText = "plaintext://";
    if(configFile.bootstrapEndpoints.toLowerCase().startsWith(plainText)) {
        return new Kafka({
            clientId,
            brokers: configFile.bootstrapEndpoints.slice(plainText.length).split(",") || [],
            logLevel: kafkaLogLevel,
        });
    } else {
        return new Kafka({
            clientId,
            brokers: configFile.bootstrapEndpoints.split(",") || [],
            logLevel: kafkaLogLevel,
            ssl: true,
            sasl: createMechanism({region}),
        });
    }
}
