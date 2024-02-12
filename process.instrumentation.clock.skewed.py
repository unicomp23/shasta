import sys
import json
from zipfile import ZipFile
import uuid
import numpy as np

def extract_and_merge_data(zip_path):
    merged_data = {}
    file_uuids = {}  # Stores UUIDs for files, generated lazily

    with ZipFile(zip_path, 'r') as zip_ref:
        for file_info in zip_ref.infolist():
            if 'instrumentation.json' in file_info.filename:
                with zip_ref.open(file_info.filename) as file:
                    data = json.load(file)
                    # Generate UUID when file is first encountered
                    if file_info.filename not in file_uuids:
                        file_uuids[file_info.filename] = str(uuid.uuid4())
                    current_file_uuid = file_uuids[file_info.filename]
                    
                    for ts_key, ts_values in data["timestamps"].items():
                        if ts_key not in merged_data:
                            merged_data[ts_key] = {}
                        
                        for field, value in ts_values.items():
                            # Check for non-zero numeric values and non-empty for other types
                            if isinstance(value, int) or isinstance(value, float):
                                is_valid = value != 0
                            else:
                                is_valid = bool(value)  # Checks for non-empty strings/lists/dicts
                            
                            if is_valid:
                                merged_data[ts_key][field] = value
                                if field == "beforePublish":
                                    merged_data[ts_key]["srcInstrumentationUuid"] = current_file_uuid
                                elif field == "afterConsume":
                                    merged_data[ts_key]["dstInstrumentationUuid"] = current_file_uuid

    return merged_data

# This function is simplified to just return the merged_data dictionary
def write_intermediate_json(merged_data):
    return merged_data

def calculate_percentiles(data):
    latencies_by_pair = {}
    # Collect latencies
    for entry in data.values():
        required_keys = ["srcInstrumentationUuid", "dstInstrumentationUuid", "afterConsume", "beforePublish"]
        if all(key in entry for key in required_keys):
            src_id = entry["srcInstrumentationUuid"]
            dst_id = entry["dstInstrumentationUuid"]
            latency = entry["afterConsume"] - entry["beforePublish"]
            pair_key = (src_id, dst_id)
            latencies_by_pair.setdefault(pair_key, []).append(latency)

    # Calculate percentiles for each pair
    percentiles_results = {}
    for pair, latencies in latencies_by_pair.items():
        latencies_array = np.array(latencies)
        percentiles_results[pair] = {
            "P50": np.percentile(latencies_array, 50),
            "P90": np.percentile(latencies_array, 90),
            "P99": np.percentile(latencies_array, 99),
            "P99.9": np.percentile(latencies_array, 99.9),
            "P99.99": np.percentile(latencies_array, 99.99),
            "P99.999": np.percentile(latencies_array, 99.999),
        }

    return percentiles_results

def calculate_differences_and_stats(data):
    latencies_by_pair = {}
    differences_by_pair = {}

    # Collect latencies
    for entry in data.values():
        required_keys = ["srcInstrumentationUuid", "dstInstrumentationUuid", "afterConsume", "beforePublish"]
        if all(key in entry for key in required_keys):
            src_id = entry["srcInstrumentationUuid"]
            dst_id = entry["dstInstrumentationUuid"]
            latency = entry["afterConsume"] - entry["beforePublish"]
            pair_key = (src_id, dst_id)
            latencies_by_pair.setdefault(pair_key, []).append(latency)

    # Calculate differences from median
    for pair, latencies in latencies_by_pair.items():
        latencies_array = np.array(latencies)
        median = np.median(latencies_array)
        differences_by_pair[pair] = {
            "D2": np.percentile(latencies_array, 99) - median,
            "D3": np.percentile(latencies_array, 99.9) - median,
            "D4": np.percentile(latencies_array, 99.99) - median,
            "D5": np.percentile(latencies_array, 99.999) - median,
        }

    # Aggregate differences for overall statistics
    all_differences = {"D2": [], "D3": [], "D4": [], "D5": []}
    for differences in differences_by_pair.values():
        for key, value in differences.items():
            all_differences[key].append(value)

    stats_results = {}
    for key, diffs in all_differences.items():
        diffs_array = np.array(diffs)
        stats_results[key] = {
            "Median": np.median(diffs_array),
            "Mean": np.mean(diffs_array),
            "StdDev": np.std(diffs_array),
            "Max": np.max(diffs_array),
            "Min": np.min(diffs_array),
        }

    return stats_results

def generate_markdown_table(stats_results):
    headers = ["Metric", "Median", "Mean", "StdDev", "Max", "Min"]
    table = []
    table.append("| " + " | ".join(headers) + " |")
    table.append("| " + " | ".join("---" for _ in headers) + " |")

    for key, stats in stats_results.items():
        row = [
            key,  # Metric name (D2, D3, D4, D5)
            str(round(stats["Median"], 2)),
            str(round(stats["Mean"], 2)),
            str(round(stats["StdDev"], 2)),
            str(round(stats["Max"], 2)),
            str(round(stats["Min"], 2))
        ]
        table.append("| " + " | ".join(row) + " |")

    return "\n".join(table)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_instrumentation.py <path_to_zip_file>")
        sys.exit(1)

    zip_file_path = sys.argv[1]
    merged_data = extract_and_merge_data(zip_file_path)
    intermediate_data = write_intermediate_json(merged_data)  # This is now a dictionary

    # Calculate and print differences and stats
    stats_results = calculate_differences_and_stats(intermediate_data)
    print("Differences Stats:")
    print(generate_markdown_table(stats_results))

