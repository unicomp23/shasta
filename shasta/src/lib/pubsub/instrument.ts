import {TagDataObjectIdentifier} from "../../../submodules/src/gen/tag_data_pb";
import {messageCount, numCPUs, pairCount} from "./loadtest";
import * as os from 'os';
import * as Redis from 'ioredis';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Add this import at the top of your file

interface ITimestamps {
    beforePublish: number;
    afterPublish: number;
    afterConsume: number;
    beforeWorkerXAdd: number;
    afterWorkerXAdd: number;
    beforeWorkerHSet: number;
    afterWorkerHSet: number;
    beforeHGetAll: number;
    afterHGetAll: number;
    beforeSubscribeXRead: number;
    afterSubscribeXRead: number;
    afterSubscribeXReadDelta: number;
}

export class Timestamps implements ITimestamps {
    public beforePublish: number = 0;
    public afterPublish: number = 0;
    public afterConsume: number = 0;
    public beforeWorkerXAdd: number = 0;
    public afterWorkerXAdd: number = 0;
    public beforeWorkerHSet: number = 0;
    public afterWorkerHSet: number = 0;
    public beforeHGetAll: number = 0;
    public afterHGetAll: number = 0;
    public beforeSubscribeXRead: number = 0;
    public afterSubscribeXRead: number = 0;
    public afterSubscribeXReadDelta: number = 0;
}

export class Instrumentation {
    private readonly timestamps = new Map<string, ITimestamps>();

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

    public getTimestamps(tdoid: TagDataObjectIdentifier): ITimestamps {
        const clone = tdoid.clone();
        const key = Buffer.from(clone.toBinary()).toString("base64");
        if (!this.timestamps.has(key)) {
            this.timestamps.set(key, new Timestamps());
        }
        return this.timestamps.get(key)!;
    }

    public dump() {
        const tmpDir = '/tmp';
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir);
        }

        const batchSize = 1000000; // Set the batch size to 10^6
        let batchNumber = 0;
        let currentBatchSize = 0;

        // Function to write a batch to a file
        const writeBatch = (batch: [string, ITimestamps][], batchNum: number) => {
            const fileName = `instrumentation-${uuidv4()}-${batchNum}.json`;
            const filePath = path.join(tmpDir, fileName);
            const writeStream = fs.createWriteStream(filePath, { flags: 'w' });
            writeStream.write('{\n');
            writeStream.write(`"hostName": "${os.hostname()}",\n`);
            writeStream.write(`"numCPUs": ${numCPUs},\n`);
            writeStream.write(`"pairCount": ${pairCount},\n`);
            writeStream.write(`"messageCount": ${messageCount},\n`);
            writeStream.write('"timestamps": {\n');
            batch.forEach(([key, value], index) => {
                const nonZeroFields = Object.entries(value).reduce((acc, [fieldKey, fieldValue]) => {
                    if (fieldValue !== 0) {
                        acc[fieldKey] = fieldValue;
                    }
                    return acc;
                }, {});
                writeStream.write(`"${key}": ${JSON.stringify(nonZeroFields)}`);
                if (index < batch.length - 1) {
                    writeStream.write(',\n');
                }
            });
            writeStream.write('\n}\n');
            writeStream.write('}\n');
            writeStream.end();
        };

        // Initialize the current batch
        let currentBatch: [string, ITimestamps][] = [];

        for (const [key, value] of this.timestamps) {
            currentBatch.push([key, value]);
            currentBatchSize++;
            if (currentBatchSize === batchSize) {
                writeBatch(currentBatch, batchNumber);
                currentBatch = []; // Reset the current batch
                currentBatchSize = 0; // Reset the current batch size
                batchNumber++; // Increment the batch number
            }
        }

        // Write the last batch if it has any timestamps
        if (currentBatchSize > 0) {
            writeBatch(currentBatch, batchNumber);
        }
    }

    public async writeNodeInstrumentData() {
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
                [key: string]: ITimestamps
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
                    const [field, val] = item[1];
                    const data = JSON.parse(val);
                    const hostname = data.hostname;
                    if (!instrumentDataByHost[hostname]) {
                        instrumentDataByHost[hostname] = [];
                    }
                    // Cast data to ITimestamps
                    const timestamps: ITimestamps = data.timestamps;
                    instrumentDataByHost[hostname].push(timestamps);
                    lastId = id;
                }
            }
            console.log(`Instrument data by host: ${JSON.stringify(instrumentDataByHost)}`);
            const schema = {
                type: "object",
                properties: {
                    beforePublish: {type: "number"},
                    afterPublish: {type: "number"},
                    afterConsume: {type: "number"},
                    beforeWorkerXAdd: {type: "number"},
                    afterWorkerXAdd: {type: "number"},
                    beforeWorkerHSet: {type: "number"},
                    afterWorkerHSet: {type: "number"}
                }
            };
            fs.writeFileSync('/tmp/instrumentation.json', JSON.stringify(instrumentDataByHost), {flag: 'w'});
            fs.writeFileSync('/tmp/instrumentation_schema.json', JSON.stringify(schema), {flag: 'w'});

            // Use the following SCP command to download files from the EC2 instance to your MacBook
            // Replace <username>, <ec2-ip-address>, <source-path> and <destination-path> with actual values
            // This is just a comment, not executable code. To execute, you need to run this command in your terminal
            // 'scp -i /path/to/your/key.pem <username>@<ec2-ip-address>:<source-path> <destination-path>'
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
