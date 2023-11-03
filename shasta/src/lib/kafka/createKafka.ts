import {Kafka} from "kafkajs";
import {kafkaLogLevel} from "./constants";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {slog} from "../logger/slog";
import * as AWS from 'aws-sdk';
import {env} from "process";


export function getServerlessBootstrapBrokers() {
    AWS.config.update({region: 'us-east-1'}); // replace 'us-east-1' with your region
    const kafka = new AWS.Kafka();

    if (!process.env.MSK_SERVERLESS_CLUSTER_ARN) {
        throw new Error('MSK_SERVERLESS_CLUSTER_ARN is not defined');
    }

    const params = {
        ClusterArn: process.env.MSK_SERVERLESS_CLUSTER_ARN // ARN of your MSK cluster
    };

    kafka.getBootstrapBrokers(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else console.log(data);           // successful response
    });

    return new Promise<string>((resolve, reject) => {
        kafka.getBootstrapBrokers(params, function (err, data) {
            if (err) {
                console.log(err, err.stack);
                reject(err);
            } else {
                console.log(data);
                console.log(`msk-serverless-broker: ${data["BootstrapBrokerStringSaslIam"]}`);
                resolve(data["BootstrapBrokerStringSaslIam"] as string);
            }
        });
    });
}

export const singleServerTcpSpacingMillis = 100;

export async function createKafka(clientId: string, region: string = 'us-east-1', numCPUs = 1) {
    if (process.argv[2] === 'msk-serverless') {
        console.log('createKafka w/ iam, using msk serverless')
        return new Kafka({
            clientId,
            brokers: [await getServerlessBootstrapBrokers()],
            logLevel: kafkaLogLevel,
            ssl: true,
            sasl: createMechanism({region: 'us-east-1'})
        });
    } else {
        const bootstrapEndpoints = env.BOOTSTRAP_BROKERS?.split(",") || [];
        slog.info("createKafka", bootstrapEndpoints);
        console.log('kafka w/ tls')
        return new Kafka({
            clientId,
            brokers: bootstrapEndpoints,
            logLevel: kafkaLogLevel,
            ssl: true,
        });
    }
}

/***

 const { Kafka } = require('kafkajs');
 const AWS = require('aws-sdk');

 // Create a new AWS STS client
 const sts = new AWS.STS();

 async function createKafkaClient() {
 // Get the IAM role credentials
 const credentials = await sts.getCredentialsForRole({ RoleArn: 'your-iam-role-arn' }).promise();

 // Create a new Kafka client
 const kafka = new Kafka({
 clientId: 'my-app',
 brokers: ['your-msk-broker1', 'your-msk-broker2'], // replace with your MSK brokers
 ssl: true, // Enable TLS
 sasl: {
 mechanism: 'aws',
 awsAccessKeyId: credentials.AccessKeyId,
 awsSecretAccessKey: credentials.SecretAccessKey,
 awsSessionToken: credentials.SessionToken,
 },
 });

 return kafka;
 }

 createKafkaClient().then(kafka => {
 // You can now use the Kafka client to produce and consume messages
 }).catch(console.error);

 */