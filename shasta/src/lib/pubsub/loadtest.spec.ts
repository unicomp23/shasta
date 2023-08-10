import {expect} from "chai";
import {describe, it} from "mocha";
import {loadTest, messageCount, pairCount} from "./loadtest";

describe("End-to-End Load Test", () => {

    it("should load test messages from Publisher to Worker via Redis Subscriber", async () => {
        const sanityCountSub = await loadTest();
        expect(sanityCountSub).to.equal(pairCount * messageCount);
    });
});

