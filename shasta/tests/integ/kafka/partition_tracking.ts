import {delay} from "@esfx/async";
import {Consumer} from "kafkajs";

export class partition_tracking {
    private last_reply_partition_index = 0;
    private partitions_ = new Array<number>();
    private partitions_stable = false;

    private constructor() {
    }

    // Getter for partitions
    public get partitions() {
        return this.partitions_;
    }

    // Static create method for creating a new partition_tracking instance
    public static create() {
        return new partition_tracking();
    }

    // Waits until the partitions become stable (consumer group join event received) or times out
    public async partitions_to_active() {
        while (!this.partitions_stable)
            await delay(100);
        // todo timeout
        return true;
    }

    // Listens for 'consumer.group_join' events and updates the partitions list accordingly
    public group_join(consumer: Consumer, topic: string) {
        consumer.on("consumer.group_join", (event) => {
            const partitions = event.payload.memberAssignment[topic];
            //console.log("consumer.group_join.partitions", partitions);
            this.partitions_ = [];
            for (const partition of partitions)
                this.partitions_.push(partition);
            this.partitions_stable = true;
        });
    }

    // Gets the next partition index in a round-robin fashion
    public async get_next_partition() {
        await this.partitions_to_active();
        this.last_reply_partition_index++;
        const index = this.last_reply_partition_index % this.partitions.length;
        this.last_reply_partition_index = index;
        const result = this.partitions[index];
        //console.log(`get_next_reply_partition.index: ${index}, ${this.partitions.length}, ${result}`);
        return result;
    }
}

/*
The `partition_tracking` class:
1. Tracks the list of partitions it is assigned to within a Kafka consumer group.
2. Waits for the consumer group join event to occur and update the list of partitions.
3. Provides a method to get the next partition index in a round-robin manner.
*/
