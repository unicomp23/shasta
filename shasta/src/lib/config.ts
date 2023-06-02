import crypto from "crypto";
import {createKafka} from "./kafka/createKafka";
import * as fs from "fs"; // Assuming the provided config class is in the same directory

interface FileConfig {
    bootstrapEndpoints: string;

    zkServers: string;
    zkTimeoutSec: number;
    zkStatsPath: string;

    statsUpdateIntervalSec: number;

    logFile: string;

    syslog: boolean;

    consoleLog: boolean;

    logLevel: string;
}

export function configFileFactory(): FileConfig {
    const appConfigPath = process.env.APP_CONFIG;

    if (!appConfigPath) {
        throw new Error('APP_CONFIG environment variable is not set');
    }

    // Read the content of the file
    const appConfigRaw = fs.readFileSync(appConfigPath, 'utf8');

    const appConfig = JSON.parse(appConfigRaw);

    const config: FileConfig = {
        bootstrapEndpoints: appConfig.bootstrapEndpoints,
        zkServers: appConfig.zkServers,
        zkTimeoutSec: appConfig.zkTimeoutSec,
        zkStatsPath: appConfig.zkStatsPath,
        statsUpdateIntervalSec: appConfig.statsUpdateIntervalSec,
        logFile: appConfig.logFile,
        syslog: appConfig.syslog,
        consoleLog: appConfig.consoleLog,
        logLevel: appConfig.logLevel,
    };

    return config;
}

class config_easy_pubsub {
    private constructor(
        private readonly config = configFileFactory(),
    ) {
    }

    public static create(test_run_id: string) {
        return new config_easy_pubsub();
    }

    // publishers, subscribers, workers
    get_tag_data() {
        return 'tag-data';
    }

    get_worker_group_id() {
        return 'tag-data-group-id';
    }

    /// global
    get_app_id() {
        return 'my_app_id';
    }

    get_kafka_brokers() {
        if(this.config.bootstrapEndpoints)
            return this.config.bootstrapEndpoints.split(',');
        if (process.env.KAFKA_BROKERS)
            return process.env.KAFKA_BROKERS.split(',');
        return ['redpanda:9092'];
    }

    get_redis_uri() {
        if (process.env.REDIS_URI)
            return process.env.REDIS_URI;
        return 'redis://redis:6379';
    }
}

export class config {
    private constructor(
        private test_run_id = "-" + crypto.randomUUID(),
        public readonly easy_pubsub = config_easy_pubsub.create(test_run_id),
    ) {
    }

    public static async create() {
        return new config();
    }
}

export async function createTopics(config_: config): Promise<void> {
    const kafka = createKafka(config_.easy_pubsub.get_app_id());

    const admin = kafka.admin();

    const requiredTopics = [
        config_.easy_pubsub.get_tag_data(),
    ];

    try {
        await admin.connect();

        await admin.createTopics({
            topics: requiredTopics.map((topicName) => ({
                topic: topicName,
            })),
            waitForLeaders: true,
        });

        console.log("All topics have been created");
    } catch (error) {
        console.error("Error creating topics:", error);
    } finally {
        try {
            await admin.disconnect();
            console.log("Cleaned up admin client");
        } catch (error) {
            console.error("Error cleaning up admin client:", error);
        }
    }
}
