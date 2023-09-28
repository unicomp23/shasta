const { AsyncQueue } = require('@esfx/async-queue');
const { Kafka } = require('kafkajs')

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: process.env.BOOTSTRAP_BROKERS.split(','),
  ssl: true
})

const uuid = require('uuid');
const topic = `my-topic-${uuid.v4()}`;
const admin = kafka.admin()

async function run() {
  try {
    console.log('Brokers:', process.env.BOOTSTRAP_BROKERS.split(','))

    console.log('Connecting...')
    await admin.connect()
    console.log('Connected.')
  
    console.log('Creating topic...')
    await admin.createTopics({
      topics: [{ topic, numPartitions: 1 }],
    })
    console.log('Topic created.')

    const producer = kafka.producer({ lingerMs: 1 })
    console.log('Connecting producer...')
    await producer.connect()
    console.log('Producer connected.')

    const consumer = kafka.consumer({ 
        groupId: 'test-group',
        // Additional settings
        fetchMaxWaitMs: 10,
        minBytes: 1,
        maxWaitTimeInMs: 10,
      })      

    console.log('Consuming messages...')
    await consumer.subscribe({ topic, fromBeginning: true, maxWaitTimeInMs: 10 })    

    const queue = new AsyncQueue();

    consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          let payload = message.value.toString();
          queue.put(payload);
        },
      });

    let last_time = performance.now();
    for (let i = 0; i < 4; i++) {
        console.log(`Producing message ${i + 1}...`)
        await producer.send({
            topic,
            messages: [{ value: `Message ${i + 1} to KafkaJS user!` }],
            acks: -1
        })
        console.log(`Message ${i + 1} produced.`)

        // Wait for the promise to resolve
        const payload = await queue.get();
        console.log({ value: payload });

        // Log elapsed time after payload
        let elapsed_time = performance.now() - last_time;
        console.log(`Elapsed time: ${elapsed_time} ms`);
        last_time = performance.now();
    }
  } catch (error) {
    console.error(`Something bad happened ${error}`)
  } finally {
    process.on('exit', async () => {
      await admin.disconnect()
    })
  }
}

run();
