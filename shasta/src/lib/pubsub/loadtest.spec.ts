import {ITopicConfig, ITopicMetadata} from "kafkajs";
import {
    TagData,
    TagDataObjectIdentifier,
} from "../../../submodules/src/gen/tag_data_pb";
import { Publisher } from "./publisher";
import { Subscriber } from "./subscriber";
import { Worker } from "./worker";
import { createKafka } from "../kafka/createKafka";
import crypto from "crypto";
import { envVarsSync } from "../../automation";
import { expect } from "chai";
import { describe, it } from "mocha";
import { AsyncQueue } from "@esfx/async-queue";
import { Kafka } from "kafkajs";
import { slog } from "../logger/slog";
import {RedisKeyCleanup} from "./redisKeyCleanup";
import {Instrumentation} from "./instrument";
import {messageCount, pairCount, runLoadTest, sanityCountSub, setupKafkaPairs, teardownTest, TestRef} from "./loadtest";

envVarsSync();

describe("End-to-End Load Test", () => {
    const pairs = new Array<TestRef>();

    before(async () => {
        expect(sanityCountSub).to.equal(0);
    });

    after(async () => {
        await teardownTest(pairs);
        expect(sanityCountSub).to.equal(pairCount * messageCount);
    });

    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {
        const cleaner = new RedisKeyCleanup();
        cleaner.deleteAllKeys()
            .then(() => cleaner.disconnect())
            .catch(console.error);
        //await deleteTestTopics();

        await setupKafkaPairs(pairs, pairCount);
        slog.info("runLoadTest");

        const start = Date.now();
        await runLoadTest(pairs, messageCount);
        const elapsed = Date.now() - start;

        const total = pairs.length * messageCount;
        slog.info(`stats:`,{ elapsed, pairs: pairs.length, messageCount, total, event_rate_per_second: total / (elapsed / 1000) });
        Instrumentation.instance.dump();
    });
});

