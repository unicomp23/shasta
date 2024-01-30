import json
import zipfile
import numpy as np
import sys
import os

def extract_and_calculate(zip_path):
    differences = []
    json_file_count = 0  # Count for all JSON files

    with zipfile.ZipFile(zip_path, 'r') as z:
        for filename in z.namelist():
            if filename.endswith('.json'):
                json_file_count += 1  # Increment count for every JSON file

                with z.open(filename) as f:
                    data = json.load(f)
                    for timestamps in data.get('timestamps', {}).values():
                        before_publish = timestamps.get('beforePublish')
                        after_subscribe_xread_delta = timestamps.get('afterSubscribeXReadDelta')
                        if before_publish and after_subscribe_xread_delta:
                            difference = after_subscribe_xread_delta - before_publish
                            differences.append(difference)

    if not differences:
        return {"error": "No valid timestamp data found"}

    differences_array = np.array(differences)
    stats = {
        "min": float(np.min(differences_array)),
        "max": float(np.max(differences_array)),
        "median": float(np.median(differences_array)),
        "25th percentile": float(np.percentile(differences_array, 25)),
        "50th percentile": float(np.percentile(differences_array, 50)),
        "75th percentile": float(np.percentile(differences_array, 75)),
        "99th percentile": float(np.percentile(differences_array, 99)),
        "99.9th percentile": float(np.percentile(differences_array, 99.9)),
        "99.99th percentile": float(np.percentile(differences_array, 99.99)),
        "99.999th percentile": float(np.percentile(differences_array, 99.999)),
        "json_file_count": json_file_count  # Use json_file_count instead of instrument_file_count
    }
    return stats

def process_directory(dir_path):
    results = []

    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith(".zip"):
                zip_file_path = os.path.join(root, file)
                print(f"Processing file: {zip_file_path}")
                stats = extract_and_calculate(zip_file_path)
                results.append({"file": zip_file_path, "stats": stats})

    return results

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python process_json.py <path_to_directory>")
        sys.exit(1)

    directory_path = sys.argv[1]
    aggregated_results = process_directory(directory_path)
    print(json.dumps(aggregated_results, indent=4))
