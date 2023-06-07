# Kafka Primitive Round Trip Test

This README provides a detailed explanation of the `primitive round trip` test case and the involved classes in the Kafka-based message queue system.

## Test Case: Primitive Round Trip

The test case, `primitive round trip`, aims to verify the correct functionality of a pub-sub system based on Kafka by publishing and consuming messages, specifically AirCoreFrame messages, between worker and reply_to topics. The test involves various classes and components, which are described in detail below.

The test, defined in `shasta/tests/integ/deep.tests/round.trip/primitives_round_trip.test.ts`, follows these steps:

1. Create a disposable stack to handle the clean-up of resources at the end of the test.
2. Connect the publisher, worker subscriber, and reply_to subscriber.
3. Wait for the worker subscriber and reply_to subscribers to join their respective Kafka consumer groups.
4. Execute the strand_worker function, which listens for frames/messages on the worker topic, and upon receiving them, forwards them to the reply_to topic.
5. Execute the strand_reply_to function, which listens for frames/messages on the reply_to topic, and upon receiving them, resolves the quit promise to indicate the test completion.
6. Publish an AirCoreFrame message to the worker topic using the publisher.
7. Wait for the quit promise to resolve, indicating that the reply_to subscriber received an AirCoreFrame message.
8. Dispose of resources using the disposable stack and complete the test.

## Classes and Components

### publisher

The `publisher` class is responsible for publishing messages to either the `worker` or `reply_to` Kafka topics based on the given topic type. It connects to the Kafka broker, initializes the Kafka producer, and sets the proper partition and key information based on the topic type before sending the message. It implements the asyncDispose() method to clean up the publisher object upon disposal.

### worker_subscriber

The `worker_subscriber` class consumes messages from the worker topic and puts them into an AsyncQueue called `frames`. It uses `partition_tracking` to keep track of the partitions in the consumer group and subscribes to the topic passed in the configuration. When connecting the consumer, it processes received messages, converting the message value to an AirCoreFrame, and adding it to the frames queue.

### reply_to_subscriber

The `reply_to_subscriber` class consumes messages from the `reply_to` Kafka topic and puts deserialized AirCoreFrame instances in an AsyncQueue called `frames`. It initializes the Kafka consumer with the appropriate group ID and connection configuration. It also provides methods to manage the consumer connection, such as isConnected() and connect(), and implements the asyncDispose() method for resource clean-up upon disposal.

### partition_tracking

The `partition_tracking` class tracks the list of partitions assigned to its Kafka consumer group. It listens for the consumer group join event to update the list of partitions and provides a method to get the next partition index in round-robin fashion.

During the test, these classes work together to:

1. Publish an AirCoreFrame message to the worker topic.
2. Consume the message in the worker topic.
3. Forward the consumed message to the reply_to topic.
4. Consume the message in the reply_to topic.
5. Confirm that the message from step 4 is the AirCoreFrame that was originally published.

The test ensures proper communication between worker and reply_to topics and the correct functioning of the Kafka-based message queue system.
