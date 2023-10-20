import * as AWS from 'aws-sdk';
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

export function getServerlessBootstrapBrokers() {
  return new Promise<string>((resolve, reject) => {
    kafka.getBootstrapBrokers(params, function(err, data) {
      if (err) {
        console.log(err, err.stack);
        reject(err);
      } else {
        console.log(data);
        resolve(data as string);
      }
    });
  });
}
