import {Kafka, logLevel} from "kafkajs";
import {kafkaLogLevel} from "./constants";
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";
import {env} from "process";

export const singleServerTcpSpacingMillis = 100;

export function createKafka(clientId: string, region: string = 'us-east-1', numCPUs = 1): Kafka {
    const bootstrapEndpoints = env.KAFKA_BROKERS?.split(",") || [];
    if(process.env.USING_IAM === "true") {
        console.log('kafka w/ iam')
        return new Kafka({
            clientId,
            brokers: bootstrapEndpoints,
            logLevel: kafkaLogLevel,
            ssl: true,
            sasl: createMechanism({ region: 'us-east-1'})
        });    
    } else {
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