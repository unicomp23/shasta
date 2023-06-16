import Redis, { RedisOptions } from "ioredis";
import { TagData, TagDataObjectIdentifier, TagDataSnapshot } from "../../../submodules/src/gen/tag_data_pb";

type Callback = (err: Error | null, snapshot?: TagDataSnapshot, delta?: TagData) => void;

class Subscriber {
    private redisClient: Redis;
    private tagDataObjIdentifier: TagDataObjectIdentifier;

    constructor(
        redisOptions: RedisOptions,
        tagDataObjIdentifier: TagDataObjectIdentifier
    ) {
        this.redisClient = new Redis(redisOptions);
        this.tagDataObjIdentifier = tagDataObjIdentifier;

        this.redisClient.on("connect", async () => {
            console.log("Connected to Redis server");
        });

        this.redisClient.on("error", async (error) => {
            console.error(`Redis error: ${error}`);
        });
    }

    public async streamSnapshotAndDeltas(callback: Callback): Promise<void> {
        try {
            // Fetch the snapshot from Redis
            const snapshotSerialized = await this.redisClient.hgetall(this.tagDataObjIdentifier.name);

            // Deserialize the snapshot using TagDataSnapshot.fromBinary method
            const snapshot = TagDataSnapshot.fromBinary(Buffer.from(snapshotSerialized));

            // Call the callback with the fetched snapshot
            callback(null, snapshot);

            // Start streaming deltas in a loop using XREAD with BLOCK option
            const readDeltas = async () => {
                const streamKey = `delta:${this.tagDataObjIdentifier.name}`;
                const deltas = await this.redisClient.xread("BLOCK", 0, "STREAMS", streamKey, "$");

                // Deserialize the delta using TagData.fromBinary method
                const delta = TagData.fromBinary(Buffer.from(deltas));

                // Call the callback with the fetched delta
                callback(null, undefined, delta);

                // Keep reading deltas
                readDeltas();
            };

            // Start reading deltas
            readDeltas();

        } catch (error) {
            // Call the callback with the error
            callback(error);
        }
    }
}