import {expect} from "chai";
import {describe, it} from "mocha";
import {loadTest, messageCount, pairCount} from "./loadtest";
import {AsyncQueue} from "@esfx/async-queue";
import crypto from "crypto";
import * as cluster from 'cluster';
import {RedisKeyCleanup} from "./redisKeyCleanup";
import {env} from "process";
import {main} from "./loadtest";

describe("End-to-End Load Test", () => {
    it("should load test messages from Publisher->Worker->Redis Subscriber", async () => {

        await main();

    });
});
