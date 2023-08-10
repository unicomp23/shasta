// worker.ts
import { parentPort } from 'worker_threads';
import {loadTest} from "./loadtest";

export interface TimestampedUuid {
    uuid: string;
    timestamp: number;
}

parentPort?.on('message', (uuid: string) => {
    loadTest().then((sanityCountSub) => {
        console.log(`sanityCountSub: ${sanityCountSub}`);
        const timestampedUuid = {
            uuid,
            timestamp: Date.now(),
        } as TimestampedUuid;
        parentPort?.postMessage(timestampedUuid);
    }).catch((error) => {
        console.error(`loadTest Error ${uuid}: ${error}`);
    });
});
