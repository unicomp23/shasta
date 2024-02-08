import sys
import json
from zipfile import ZipFile

def extract_data(zip_path):
    file_list = []
    intermediate_data = []
    with ZipFile(zip_path, 'r') as zip_ref:
        for file_info in zip_ref.infolist():
            if 'instrumentation.json' in file_info.filename:
                file_list.append(file_info.filename)
                
    with ZipFile(zip_path, 'r') as zip_ref:
        for file_name in file_list:
            with zip_ref.open(file_name) as file:
                data = json.load(file)
                for ts_key, ts_values in data["timestamps"].items():
                    filtered_values = {k: v for k, v in ts_values.items() if v != 0}
                    if filtered_values:
                        intermediate_data.append({
                            "timestamp_key": ts_key,
                            "data": filtered_values
                        })
    return intermediate_data

def write_intermediate_json(intermediate_data, intermediate_path):
    with open(intermediate_path, 'w') as f:
        json.dump(intermediate_data, f, indent=4)

if __name__ == "__main__":
    zip_file_path = sys.argv[1]
    intermediate_data = extract_data(zip_file_path)
    intermediate_json_path = '/tmp/instrumentation.intermediate.json'
    write_intermediate_json(intermediate_data, intermediate_json_path)
    print(f"Intermediate data has been written to {intermediate_json_path}")
