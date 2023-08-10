import {expect} from "chai";
import {describe, it} from "mocha";
import {loadTest, messageCount, pairCount} from "./loadtest";
import { Worker } from 'worker_threads';
import path from 'path';
import {AsyncQueue} from "@esfx/async-queue";
import {TimestampedUuid} from "./loadtestThread";
import crypto from "crypto";

describe("End-to-End Load Test", () => {

    it("should load test messages from Publisher->Worker->Redis Subscriber", async () => {
        const sanityCountSub = await loadTest();
        expect(sanityCountSub).to.equal(pairCount * messageCount);
    });

    it("should spawn web worker threads to load test messages from Publisher->Worker->Redis Subscriber", async () => {

        const count = 4;
        const completions = new AsyncQueue<TimestampedUuid>();

        for(let i = 0; i < count; i++) {
            const worker = new Worker(path.join(__dirname, 'loadtestThread.ts'), {
                execArgv: ['-r', 'ts-node/register'], // Using ts-node to run the worker
            });

            worker.on('message', (data: TimestampedUuid) => {
                console.log(`Received UUID, main: ${data.uuid} with Timestamp: ${data.timestamp}`);
                completions.put(data);
                worker.terminate();
            });

            worker.on('error', (error) => {
                console.error(`Worker Error: ${error}`);
                worker.terminate();
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code}`);
                }
            });

            const uuid = crypto.randomUUID();
            worker.postMessage(uuid);
        }

        for(let i = 0; i < count; i++) {
            const data = await completions.get();
            console.log(`Received UUID: ${data.uuid} with Timestamp: ${data.timestamp}`);
        }

        expect(completions.size).to.equal(0);
    });
});
