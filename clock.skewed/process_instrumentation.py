import sys
import json
from zipfile import ZipFile
import uuid

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

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_instrumentation.py <path_to_zip_file>")
        sys.exit(1)

    zip_file_path = sys.argv[1]
    merged_data = extract_and_merge_data(zip_file_path)
    intermediate_json_path = '/tmp/instrumentation.intermediate.json'
    write_intermediate_json(merged_data, intermediate_json_path)
    
    print(f"Data has been processed and written to {intermediate_json_path}")
