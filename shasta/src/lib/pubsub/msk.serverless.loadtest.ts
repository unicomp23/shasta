import * as AWS from 'aws-sdk';
import {env} from "process";


function getServerlessBootstrapBrokers() {
  AWS.config.update({region:'us-east-1'}); // replace 'us-east-1' with your region
  const kafka = new AWS.Kafka();
  
  if (!process.env.MSK_SERVERLESS_CLUSTER_ARN) {
    throw new Error('MSK_SERVERLESS_CLUSTER_ARN is not defined');
  }
  
  const params = {
    ClusterArn: process.env.MSK_SERVERLESS_CLUSTER_ARN // ARN of your MSK cluster
  };
  
  kafka.getBootstrapBrokers(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });
  
  return new Promise<string>((resolve, reject) => {
    kafka.getBootstrapBrokers(params, function(err, data) {
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

export async function setupServerlessEnvironment(): Promise<void> {
  if (process.argv[2] === 'msk-serverless') {
      // Use MSK Serverless bootstrap brokers
      env.BOOTSTRAP_BROKERS = await getServerlessBootstrapBrokers();
      process.env.USING_IAM = "true";
      console.log('Using MSK Serverless with IAM');
  }
}
