import crypto from "crypto";
import {AsyncQueue} from "@esfx/async";
import {AirCoreFrame} from "../proto/gen/devinternal_pb";
import {AsyncDisposable} from "@esfx/disposable";
import {config} from "../config";
import {partition_tracking} from "./partition_tracking";
import {createKafka} from "../common/createKafka";

export class reply_to_subscriber {
  public readonly partition_tracking_ = partition_tracking.create();
  public readonly frames = new AsyncQueue<AirCoreFrame>();
  private readonly runner_ = (async () => {
    this.partition_tracking_.group_join(this.consumer, this.topic);
    await this.consumer.subscribe({
      topic: this.config_.easy_pubsub.get_reply_to_topic(),
      fromBeginning: false,
    })
    await this.consumer.run({
      eachMessage: async ({topic, partition, message}) => {
        const frame = AirCoreFrame.fromBinary(message.value!);
        this.frames.put(frame);
      },
    })
    return true;
  })();
  private joined = false;

  private constructor(
    private readonly config_: config,
    readonly topic = config_.easy_pubsub.get_reply_to_topic(),
    private readonly kafka = createKafka(config_.easy_pubsub.get_app_id() + '/reply_to/' + crypto.randomUUID()),
    private readonly consumer = kafka.consumer({
      groupId: config_.easy_pubsub.get_reply_to_group_id()
    }),
  ) {
    consumer.on(consumer.events.FETCH_START, async () => {
      this.joined = true;
    });
  }

  // Static create method for creating a new reply_to_subscriber instance
  public static create(config_: config) {
    return new reply_to_subscriber(config_);
  }

  // Connects the Kafka consumer to the broker
  public async connect() {
    await this.consumer.connect()
  }

  // Returns the connection status of the consumer
  public is_joined() {
    return this.joined;
  }

  // Implements the asyncDispose method for clean disposal of the reply_to_subscriber object
  async [AsyncDisposable.asyncDispose]() {
    await this.consumer.stop();
    await this.consumer.disconnect();
  }
}

/*
The `reply_to_subscriber` class:

1. Subscribes to the `reply_to` Kafka topic.
2. Initializes the Kafka consumer with the appropriate group ID and connection configuration.
3. Upon receiving messages, deserializes the binary content into `AirCoreFrame` instances and adds them to an async queue.
4. Provides a method to connect the Kafka consumer to the broker, and another method to check if the consumer is connected.
5. Implements the `AsyncDisposable.asyncDispose` method to properly dispose of the consumer instance upon termination.
 */