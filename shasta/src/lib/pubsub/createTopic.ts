import { generateTopicAndGroupId, createAndVerifyKafkaTopic } from './topic';

async function mainCreateTopic() {
    const { kafkaTopicLoad } = generateTopicAndGroupId();
    await createAndVerifyKafkaTopic(kafkaTopicLoad);
}

mainCreateTopic().then(() => {
    console.log('mainCreateTopic, exit main');
}).catch((error) => {
    console.error('mainCreateTopic, An error occurred:', error);
});
