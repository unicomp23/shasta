import fs from 'fs';

// Define the Config interface
interface Config {
    "#": string,
    "bootstrap-endpoints": string,
    "memorydb-endpoint-address": string,
    "memorydb-endpoint-port": string
}

function removeJsonComments(dataString: string): string {
    dataString = dataString.trim();
    dataString = dataString.substring(1);  // remove first {
    dataString = dataString.slice(0, -1);  // remove last }

    // split the string by commas
    let lines = dataString.split(',');

    // filter out lines with '#' key
    lines = lines.filter(line => !line.trim().startsWith('"#"'));

    // remove trailing comma in last line
    if (lines[lines.length - 1].trim() === '') {
        lines.pop();
    }

    // join the arr back with commas
    const cleanDataString = lines.join(',');

    return '{' + cleanDataString + '}'; // Adding the opening and closing braces
}

// Helper function to read and return Config interface object from JSON file
function getConfig(): Config {
    const configFilePath = process.env.APP_CONFIG || process.env.AUTOMATION_APP_CONFIG;

    if (configFilePath) {
        if (fs.existsSync(configFilePath)) {
            const rawData = fs.readFileSync(configFilePath, 'utf-8');
            const filteredData = removeJsonComments(rawData);
            console.log(filteredData);
            return JSON.parse(filteredData);
        } else {
            throw new Error(`File doesn't exist at path: ${configFilePath}`);
        }
    } else {
        throw new Error("Environment variable APP_CONFIG || AUTOMATION_APP_CONFIG is not set");
    }
}

export function envVarsSync() {
    const config_ = getConfig();
    process.env["BOOTSTRAP_BROKERS"] = config_["bootstrap-endpoints"];
    process.env["REDIS_HOST"] = config_["memorydb-endpoint-address"];
    process.env["REDIS_PORT"] = config_["memorydb-endpoint-port"];
}