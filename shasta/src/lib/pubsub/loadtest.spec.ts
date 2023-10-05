import {expect} from "chai";
import {describe, it} from "mocha";
import {deleteTestTopics, loadTest, messageCount, pairCount} from "./loadtest";
import {AsyncQueue} from "@esfx/async-queue";
import crypto from "crypto";
import * as cluster from 'cluster';
import {RedisKeyCleanup} from "./redisKeyCleanup";
import {env} from "process";

export const numCPUs = 1;

describe("End-to-End Load Test", () => {
    it("should load test messages from Publisher->Worker->Redis Subscriber", async () => {

        if(env.MEMORY_DB_ENDPOINT_ADDRESS && env.MEMORY_DB_ENDPOINT_ADDRESS.length > 0)
            env.REDIS_HOST = env.MEMORY_DB_ENDPOINT_ADDRESS;
        env.REDIS_PORT = "6379";
        if(env.BOOTSTRAP_BROKERS && env.BOOTSTRAP_BROKERS.length > 0)
            env.KAFKA_BROKERS = env.BOOTSTRAP_BROKERS;

        /*** todo await deleteTestTopics();
        const cleaner = new RedisKeyCleanup();
        cleaner.deleteAllKeys()
            .then(() => cleaner.disconnect())
            .catch(console.error); ***/

        console.log(`numCPUs: ${numCPUs}`);
        const randomTag = "020"; // todo crypto.randomUUID();
        const kafkaTopicLoad = `test_topic_load-${randomTag}`;
        const groupId = `test_group_id-${randomTag}`;

        const sanityCountSub = await loadTest(kafkaTopicLoad, numCPUs, groupId);
        expect(sanityCountSub).to.equal(pairCount * messageCount);

    });
});
