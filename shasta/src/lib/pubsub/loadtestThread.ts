// worker.ts
import { parentPort } from 'worker_threads';

export interface TimestampedUuid {
    uuid: string;
    timestamp: number;
}

parentPort?.on('message', (uuid: string) => {
    const timestampedUuid = {
        uuid,
        timestamp: Date.now(),
    } as TimestampedUuid;
    parentPort?.postMessage(timestampedUuid);
});
