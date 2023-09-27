import { SQS } from 'aws-sdk';

const sqs = new SQS({ region: 'us-east-1' }); // replace with your region todo

async function receiveMessages() {
  const params = {
    QueueUrl: process.env.SQS_QUEUE_URL || 'default_queue_url',
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 60,
    WaitTimeSeconds: 20 // Set to 20 seconds
  };

  while (true) {
    try {
      const data = await sqs.receiveMessage(params).promise();

      if (data.Messages) {
        for (const message of data.Messages) {
          console.log('Message:', message.Body);

          const deleteParams = {
            QueueUrl: params.QueueUrl,
            ReceiptHandle: message.ReceiptHandle!
          };

          try {
            await sqs.deleteMessage(deleteParams).promise();
            console.log('Message deleted', message.MessageId);
          } catch (deleteError) {
            console.log('Delete error', deleteError);
          }
        }
      } else {
        console.log('No messages to process');
      }
    } catch (receiveError) {
      console.log('Receive error', receiveError);
    }
  }
}

receiveMessages();
