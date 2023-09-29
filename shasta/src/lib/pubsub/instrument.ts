import {TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {slog} from "../logger/slog";
import {messageCount, pairCount} from "./loadtest";
import {numCPUs} from "./loadtest.spec";
import * as os from 'os';
import * as Redis from 'ioredis';
import assert from 'assert';

export class Timestamps {
    public beforePublish: number = 0;
    public afterPublish: number = 0;
    public afterConsume: number = 0;
    public afterWorkerXAdd: number = 0;
    public afterWorkerHSet: number = 0;
    public afterSubscribeXRead: number = 0;
}

export class Instrumentation {
    private readonly timestamps = new Map<string, Timestamps>();

    private static _instance: Instrumentation;

    public static get instance(): Instrumentation {
        if (!Instrumentation._instance) {
            Instrumentation._instance = new Instrumentation();
        }
        return Instrumentation._instance;
    }

    private _enabled: boolean = false;

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(value: boolean) {
        this._enabled = value;
    }

    public getTimestamps(tdoid: TagDataObjectIdentifier): Timestamps {
        const clone = tdoid.clone();
        const key = Buffer.from(clone.toBinary()).toString("base64");
        if (!this.timestamps.has(key)) {
            this.timestamps.set(key, new Timestamps());
        }
        return this.timestamps.get(key)!;
    }

    public dump() {
        const timestampsObj = Array.from(this.timestamps).reduce((obj: {
            [key: string]: Timestamps
        }, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
        slog.info("", {
                instrumentData: {
                    numCPUs,
                    pairCount,
                    messageCount,
                    timestamps: timestampsObj
                }
            }
        );
    }

    public async dumpToRedisStream() {
        assert(process.env.REDIS_HOST, 'REDIS_HOST is not defined in the environment variables');
        assert(process.env.REDIS_PORT, 'REDIS_PORT is not defined in the environment variables');

        const redis = new Redis.Cluster([{
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || "6379")
        }], {
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: {
                tls: {},
            },
        });
        try {
            await new Promise((resolve, reject) => {
                redis.on('ready', resolve);
                redis.on('error', reject);
            });

            const timestampsObj = Array.from(this.timestamps).reduce((obj: {
                [key: string]: Timestamps
            }, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
            const instrumentData = {
                numCPUs,
                pairCount,
                messageCount,
                timestamps: timestampsObj
            };
            await redis.xadd("instrument_data", os.hostname(), 'data', JSON.stringify(instrumentData));
            console.log('Data dumped to Redis stream successfully');
        } catch (error) {
            console.error('Error during data dump operation:', error);
        } finally {
            try {
                await redis.quit();
                console.log('Redis connection closed successfully');
            } catch (error) {
                console.error('Error during quit operation:', error);
            }
        }
    }

    public async readAllInstrumentData() {
        assert(process.env.REDIS_HOST, 'REDIS_HOST is not defined in the environment variables');
        assert(process.env.REDIS_PORT, 'REDIS_PORT is not defined in the environment variables');

        const redis = new Redis.Cluster([{
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || "6379")
        }], {
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: {
                tls: {},
            },
        });
        const instrumentDataByHost: {
            [hostname: string]: any
        } = {};
        try {
            await new Promise((resolve, reject) => {
                redis.on('ready', resolve);
                redis.on('error', reject);
            });

            const streamName = "instrument_data";
            let lastId = '0';
            while (true) {
                const result = await redis.xread('COUNT', 100, 'STREAMS', streamName, lastId);
                if (!result) {
                    break;
                }
                for (const item of result[0][1]) {
                    const id = item[0];
                    const data = JSON.parse(item[1][1]);
                    const hostname = data.hostname;
                    if (!instrumentDataByHost[hostname]) {
                        instrumentDataByHost[hostname] = [];
                    }
                    instrumentDataByHost[hostname].push(data);
                    lastId = id;
                }
            }
            console.log(`Instrument data by host: ${JSON.stringify(instrumentDataByHost)}`);
        } catch (error) {
            console.error('Error during xread operation:', error);
        } finally {
            try {
                await redis.quit();
                console.log('Redis connection closed successfully');
            } catch (error) {
                console.error('Error during quit operation:', error);
            }
        }
    }
}
