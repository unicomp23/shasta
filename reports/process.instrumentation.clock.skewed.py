import sys
import json
from zipfile import ZipFile
import uuid
import numpy as np
import os

def extract_and_merge_data(zip_path):
    merged_data = {}
    file_identifiers = {}  # Stores parent directory names for files

    with ZipFile(zip_path, 'r') as zip_ref:
        for file_info in zip_ref.infolist():
            if file_info.filename.endswith('.json'):  # Adjusted to check for any .json file
                print(f"Processing JSON file: {file_info.filename}")  # Log the JSON file path
                with zip_ref.open(file_info.filename) as file:
                    # Use 'ignore' to skip invalid byte sequences
                    file_content = file.read().decode('utf-8', 'ignore')
                    
                    try:
                        # Attempt to load the JSON data
                        data = json.loads(file_content)
                    except json.decoder.JSONDecodeError as e:
                        # If there is extra data, process valid part of the JSON
                        valid_json_part = file_content[:e.pos]
                        data = json.loads(valid_json_part)
                        print(f"Warning: Processed valid part of JSON data in {file_info.filename} up to position {e.pos}. Extra data ignored.")

                    # Use parent directory name as identifier
                    parent_dir_name = os.path.basename(os.path.dirname(file_info.filename))
                    file_identifiers[file_info.filename] = parent_dir_name
                    current_file_identifier = file_identifiers[file_info.filename]
                    
                    for ts_key, ts_values in data.get("timestamps", {}).items():
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
                                    merged_data[ts_key]["srcInstrumentationIdentifier"] = current_file_identifier
                                elif field == "afterConsume":
                                    merged_data[ts_key]["dstInstrumentationIdentifier"] = current_file_identifier

    return merged_data

# This function is simplified to just return the merged_data dictionary
def write_intermediate_json(merged_data):
    return merged_data

def calculate_percentiles(data):
    latencies_by_pair = {}
    # Collect latencies
    for entry in data.values():
        required_keys = ["srcInstrumentationIdentifier", "dstInstrumentationIdentifier", "afterConsume", "beforePublish"]
        if all(key in entry for key in required_keys):
            src_id = entry["srcInstrumentationIdentifier"]
            dst_id = entry["dstInstrumentationIdentifier"]
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
        required_keys = ["srcInstrumentationIdentifier", "dstInstrumentationIdentifier", "afterConsume", "beforePublish"]
        if all(key in entry for key in required_keys):
            src_id = entry["srcInstrumentationIdentifier"]
            dst_id = entry["dstInstrumentationIdentifier"]
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

def generate_markdown_table(all_stats_results):
    headers = ["Parent Directory", "Metric", "Median", "Mean", "StdDev", "Max", "Min"]
    table = []
    table.append("| " + " | ".join(headers) + " |")
    table.append("| " + " | ".join("---" for _ in headers) + " |")

    for parent_dir_name, stats_results in all_stats_results.items():
        for key, stats in stats_results.items():
            row = [
                parent_dir_name,  # Parent directory name now on the far left
                key,  # Metric name (D2, D3, D4, D5)
                str(round(stats["Median"], 2)),
                str(round(stats["Mean"], 2)),
                str(round(stats["StdDev"], 2)),
                str(round(stats["Max"], 2)),
                str(round(stats["Min"], 2)),
            ]
            table.append("| " + " | ".join(row) + " |")

    return "\n".join(table)

def generate_d2_d3_markdown_tables(all_stats_results):
    # Define headers for D2 and D3 tables
    headers = ["Configuration", "Median", "Mean", "StdDev", "Max", "Min"]
    
    # Initialize tables for D2 and D3
    d2_table = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    d3_table = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    
    for parent_dir_name, stats_results in all_stats_results.items():
        if "D2" in stats_results:
            d2_stats = stats_results["D2"]
            d2_row = [
                parent_dir_name,
                str(round(d2_stats["Median"], 2)),
                str(round(d2_stats["Mean"], 2)),
                str(round(d2_stats["StdDev"], 2)),
                str(round(d2_stats["Max"], 2)),
                str(round(d2_stats["Min"], 2)),
            ]
            d2_table.append("| " + " | ".join(d2_row) + " |")
        
        if "D3" in stats_results:
            d3_stats = stats_results["D3"]
            d3_row = [
                parent_dir_name,
                str(round(d3_stats["Median"], 2)),
                str(round(d3_stats["Mean"], 2)),
                str(round(d3_stats["StdDev"], 2)),
                str(round(d3_stats["Max"], 2)),
                str(round(d3_stats["Min"], 2)),
            ]
            d3_table.append("| " + " | ".join(d3_row) + " |")
    
    # Combine D2 and D3 tables into a single string with a separator
    combined_tables = "\n\nD2 Metrics Table:\n" + "\n".join(d2_table) + "\n\nD3 Metrics Table:\n" + "\n".join(d3_table)
    return combined_tables

def process_directory(directory_path):
    all_stats_results = {}  # Collect stats results from all directories
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.endswith(".zip"):
                zip_path = os.path.join(root, file)
                parent_dir_name = os.path.basename(os.path.dirname(zip_path))  # Get the parent directory name
                print(f"Processing {zip_path}")
                merged_data = extract_and_merge_data(zip_path)
                intermediate_data = write_intermediate_json(merged_data)  # This is now a dictionary

                # Calculate stats for current zip file
                stats_results = calculate_differences_and_stats(intermediate_data)
                all_stats_results[parent_dir_name] = stats_results

    # Generate and print a single markdown table for all directories
    print("Differences Stats for All Directories:")
    print(generate_markdown_table(all_stats_results))
    
    # Generate and print D2 and D3 tables
    print("\nD2 and D3 Metrics Tables:")
    print(generate_d2_d3_markdown_tables(all_stats_results))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_instrumentation.py <path_to_directory>")
        sys.exit(1)

    directory_path = sys.argv[1]
    process_directory(directory_path)
