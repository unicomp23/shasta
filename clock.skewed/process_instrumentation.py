import sys
import json
from zipfile import ZipFile

def extract_and_merge_data(zip_path):
    file_list = []
    merged_data = {}
    with ZipFile(zip_path, 'r') as zip_ref:
        for file_info in zip_ref.infolist():
            if 'instrumentation.json' in file_info.filename:
                file_list.append(file_info.filename)
                
    with ZipFile(zip_path, 'r') as zip_ref:
        for file_name in file_list:
            with zip_ref.open(file_name) as file:
                data = json.load(file)
                for ts_key, ts_values in data["timestamps"].items():
                    # Initialize the key if it doesn't exist
                    if ts_key not in merged_data:
                        merged_data[ts_key] = {}
                    # Merge values, ignoring zeros
                    for field, value in ts_values.items():
                        if value != 0:
                            # If the field exists, sum the values; otherwise, initialize it
                            if field in merged_data[ts_key]:
                                merged_data[ts_key][field] += value
                            else:
                                merged_data[ts_key][field] = value
    return merged_data

def write_intermediate_json(merged_data, intermediate_path):
    with open(intermediate_path, 'w') as f:
        # Pretty print the JSON data with an indentation of 4 spaces
        json.dump(merged_data, f, indent=4)

if __name__ == "__main__":
    zip_file_path = sys.argv[1]
    merged_data = extract_and_merge_data(zip_file_path)
    intermediate_json_path = '/tmp/instrumentation.intermediate.json'
    write_intermediate_json(merged_data, intermediate_json_path)
    print(f"Merged data has been written to {intermediate_json_path}")
