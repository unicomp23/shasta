import { SQS } from 'aws-sdk';

const sqs = new SQS({ region: 'us-east-1' }); // replace with your region

async function receiveMessages() {
  const params = {
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue', // replace with your queue URL
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 60,
    WaitTimeSeconds: 0
  };

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

receiveMessages();
