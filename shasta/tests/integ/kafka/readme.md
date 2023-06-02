# Easy Pub/Sub with Kafka

Testing only, not for production, when prod code in /src matures this will be removed. To be used as a reference only
and sanity check against aws/msk and local dev (ie docker compose) env's.

In this solution, we use Kafka as a message broker to implement a simple publish-subscribe pattern for sending,
handling, and receiving messages between services. We will cover the implementation details of the provided classes and
their purpose, and how they can be used to create a publisher and subscribers for the `worker` and `reply_to` topics.

## Implementation Overview

The provided solution consists of the following classes:

- `partition_tracking`
- `publisher`
- `reply_to_subscriber`
- `worker_subscriber`

Let's dive into the classes' purposes, implementations, and how they interact with each other.

### `partition_tracking` Class

The `partition_tracking` class is responsible for managing the list of partitions assigned to a Kafka consumer within a
consumer group. It waits for the `consumer.group_join` event to occur, indicating the assignment of partitions. It then
provides a method `get_next_partition()` to get the next partition index in a round-robin manner.

### `publisher` Class

The `publisher` class is used to send messages to either the `worker` or `reply_to` Kafka topics, based on the
specified `topic_type`.

Upon creating a publisher instance, it initializes a Kafka producer with the partitioner and the topic creation setting.
It also provides a method `send()` to send an `AirCoreFrame` message to the appropriate topic. The message partition and
key information are set based on the `topic_type`.

Lastly, the publisher class implements the `AsyncDisposable.asyncDispose()` method for clean disposal of the producer
instance when it's no longer needed.

### `reply_to_subscriber` Class

The `reply_to_subscriber` class subscribes to the `reply_to` Kafka topic and listens for new messages, deserializing the
binary content into `AirCoreFrame` instances, and adding them to an async queue named `frames`.

It initializes a Kafka consumer with the appropriate group ID and connection configuration. It also provides a method to
connect the consumer to the broker and a method to check the connection status. The class implements
the `AsyncDisposable.asyncDispose()` method to properly dispose of the consumer instance upon termination.

### `worker_subscriber` Class

The `worker_subscriber` class has a similar structure and purpose to the `reply_to_subscriber` class, but it subscribes
to the `worker` Kafka topic instead.

## How to Use the Classes

With the given classes, one can create a publisher and subscribers for both the `worker` and `reply_to` topics.

1. Create a `config` instance containing the required Kafka configuration information and topic names.

2. Create a `publisher` instance using the `publisher.create()` method and the config instance:
   ```typescript
   const pub = publisher.create(configInstance);
   ```

3. Create a `worker_subscriber` instance using the `worker_subscriber.create()` method and the config instance:
   ```typescript
   const workerSub = worker_subscriber.create(configInstance);
   await workerSub.connect();
   ```

4. Create a `reply_to_subscriber` instance using the `reply_to_subscriber.create()` method and the config instance:
   ```typescript
   const replyToSub = reply_to_subscriber.create(configInstance);
   await replyToSub.connect();
   ```

5. Use the `publisher.send()` method to send messages to the `worker` and `reply_to` topics.
6. Listen for new messages in the `worker_subscriber` and `reply_to_subscriber` instances by consuming messages from
   their `frames` queues.
