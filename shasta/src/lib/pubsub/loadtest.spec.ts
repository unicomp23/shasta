import {expect} from "chai";
import {describe, it} from "mocha";
import {deleteTestTopics, loadTest, messageCount, pairCount} from "./loadtest";
import { Worker } from 'worker_threads';
import path from 'path';
import {AsyncQueue} from "@esfx/async-queue";
import crypto from "crypto";
import * as cluster from 'cluster';
import * as http from 'http';
import * as os from 'os';
import {RedisKeyCleanup} from "./redisKeyCleanup";
import {env} from "process";

describe("End-to-End Load Test", () => {
    it("should load test messages from Publisher->Worker->Redis Subscriber", async () => {

        env.REDIS_HOST = "clustercfg.shasta-redis-automation786.3ezarj.memorydb.us-east-1.amazonaws.com";
        env.REDIS_PORT = "6379";
        env.KAFKA_BROKERS = "b-1.shastamskautomation78.znsa2v.c21.kafka.us-east-1.amazonaws.com:9092,b-2.shastamskautomation78.znsa2v.c21.kafka.us-east-1.amazonaws.com:9092,b-3.shastamskautomation78.znsa2v.c21.kafka.us-east-1.amazonaws.com:9092";
        env.NOTLS = "true";

    	await deleteTestTopics();
        const cleaner = new RedisKeyCleanup();
        cleaner.deleteAllKeys()
            .then(() => cleaner.disconnect())
            .catch(console.error);

        const numCPUs = 1; //os.cpus().length / 2;
        console.log(`numCPUs: ${numCPUs}`);
        const exitQueue = new AsyncQueue<number>();

        if (cluster.default.isPrimary) {
            const kafkaTopicLoad = `test_topic_load-12345`;
            const groupId = `test_group_id-${crypto.randomUUID()}`;

            // Fork workers.
            for (let i = 0; i < numCPUs; i++) {
                const worker = cluster.default.fork({ KAFKA_TOPIC_LOAD: kafkaTopicLoad, KAFKA_GROUP_ID: groupId });
                console.log(`Worker ${worker.process.pid} forked, primary`);
            }

            cluster.default.on('exit', (worker, code, signal) => {
                console.log(`Worker ${worker.process.pid} died, worker`);
                if(worker.process.pid !== undefined)
                    exitQueue.put(worker.process.pid);
            });

            cluster.default.on('message', (worker, message, handle) => {
                console.log(`Worker ${worker.process.pid} sent message: ${message}`);
            });

            for(let i = 0; i < numCPUs; i++) {
                const pid = await exitQueue.get();
                console.log(`Worker ${pid} died, primary`);
            }
        } else {
            const kafkaTopicLoad = process.env.KAFKA_TOPIC_LOAD;
            if(kafkaTopicLoad === undefined) throw new Error("KAFKA_TOPIC_LOAD environment variable is not set");
            const groupId = process.env.KAFKA_GROUP_ID;
            if(groupId === undefined) throw new Error("KAFKA_GROUP_ID environment variable is not set");
            const sanityCountSub = await loadTest(kafkaTopicLoad, numCPUs, groupId);
            expect(sanityCountSub).to.equal(pairCount * messageCount);
            if(process.send !== undefined) {
                process.send(JSON.stringify({sanityCountSub, pid: process.pid}));
                process.exit(0);
            }
        }
    });
});
