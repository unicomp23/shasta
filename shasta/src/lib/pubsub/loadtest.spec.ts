import {envVarsSync} from "../../automation";
import {expect} from "chai";
import {describe, it} from "mocha";
import {loadTest, messageCount, pairCount} from "./loadtest";

envVarsSync();

describe("End-to-End Load Test", () => {
    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {
        expect(loadTest()).to.equal(pairCount * messageCount);
    });
});

