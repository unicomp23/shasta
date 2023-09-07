import {TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {slog} from "../logger/slog";
import {messageCount, pairCount} from "./loadtest";
import {numCPUs} from "./loadtest.spec";

export class Timestamps {
    public beforePublish: number = 0;
    public afterPublish: number = 0;
    public afterConsume: number = 0;
    public afterWorkerXAdd: number = 0;
    public afterWorkerHSet: number = 0;
    public afterSubscribeXRead: number = 0;
}

export class Instrumentation {
    private static _instance: Instrumentation;
    private _enabled: boolean = false;

    private readonly timestamps = new Map<string, Timestamps>();

    public getTimestamps(tdoid: TagDataObjectIdentifier): Timestamps {
        const clone = tdoid.clone();
        const key = Buffer.from(clone.toBinary()).toString("base64");
        if (!this.timestamps.has(key)) {
            this.timestamps.set(key, new Timestamps());
        }
        return this.timestamps.get(key)!;
    }

    public static get instance(): Instrumentation {
        if (!Instrumentation._instance) {
            Instrumentation._instance = new Instrumentation();
        }
        return Instrumentation._instance;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(value: boolean) {
        this._enabled = value;
    }

    public dump() {
        const timestampsObj = Array.from(this.timestamps).reduce((obj: { [key: string]: Timestamps }, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
        slog.info("", {
            numCPUs,
            pairCount,
            messageCount,
            timestamps: timestampsObj
        });
    }
}
