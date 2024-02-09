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

def write_intermediate_json(merged_data, intermediate_path):
    with open(intermediate_path, 'w') as f:
        json.dump(merged_data, f, indent=4)

def calculate_percentiles(intermediate_path):
    with open(intermediate_path) as f:
        data = json.load(f)

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
            "P99.999": np.percentile(latencies_array, 99.999),  # Adding the 99.999th percentile
        }

    return percentiles_results

def calculate_differences_and_stats(intermediate_path):
    with open(intermediate_path) as f:
        data = json.load(f)

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

    # Calculate and return statistics
    stats = {}
    for key, values in all_differences.items():
        values_array = np.array(values)
        stats[key] = {
            "Mean": np.mean(values_array),
            "Median": np.median(values_array),
            "Max": np.max(values_array),
            "Min": np.min(values_array),
        }

    return stats

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_instrumentation.py <path_to_zip_file>")
        sys.exit(1)

    zip_file_path = sys.argv[1]
    merged_data = extract_and_merge_data(zip_file_path)
    intermediate_json_path = '/tmp/instrumentation.intermediate.json'
    write_intermediate_json(merged_data, intermediate_json_path)
    
    #print(f"Data has been processed and written to {intermediate_json_path}")

    # Calculate and print percentiles
    # percentiles_results = calculate_percentiles(intermediate_json_path)
    # print("Percentiles Results:")
    # for pair, results in percentiles_results.items():
    #     print(f"Pair {pair}:")
    #     for metric, value in results.items():
    #         print(f"  {metric}: {value}")
    # Calculate and print differences and stats
    stats_results = calculate_differences_and_stats(intermediate_json_path)
    print("Differences Stats:")
    for key, stats in stats_results.items():
        print(f"{key}:")
        for stat_name, value in stats.items():
            print(f"  {stat_name}: {value}")
