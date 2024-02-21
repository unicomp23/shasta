import json
import zipfile
import numpy as np
import sys
import os

def extract_and_calculate(zip_path):
    differences = []
    json_file_count = 0

    with zipfile.ZipFile(zip_path, 'r') as z:
        for filename in z.namelist():
            if filename.endswith('.json'):
                json_file_count += 1

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
        "min": round(float(np.min(differences_array)), 2),
        "max": round(float(np.max(differences_array)), 2),
        "median": round(float(np.median(differences_array)), 2),
        "25th percentile": round(float(np.percentile(differences_array, 25)), 2),
        "50th percentile": round(float(np.percentile(differences_array, 50)), 2),
        "75th percentile": round(float(np.percentile(differences_array, 75)), 2),
        "99th percentile": round(float(np.percentile(differences_array, 99)), 2),
        "99.9th percentile": round(float(np.percentile(differences_array, 99.9)), 2),
        "99.99th percentile": round(float(np.percentile(differences_array, 99.99)), 2),
        "99.999th percentile": round(float(np.percentile(differences_array, 99.999)), 2),
        "json_file_count": json_file_count
    }
    return stats

def process_directory(dir_path):
    results = []
    zip_files = []

    # Gather all zip file paths first to calculate total and progress
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith(".zip"):
                zip_file_path = os.path.join(root, file)
                zip_files.append(zip_file_path)

    total_files = len(zip_files)
    print(f"Total zip files to process: {total_files}")

    # Process each zip file and update progress
    for i, zip_file_path in enumerate(zip_files, start=1):
        dir_name = os.path.basename(os.path.dirname(zip_file_path))
        zip_filename = os.path.basename(zip_file_path)  # Get the ZIP filename
        print(f"Processing file {i} of {total_files}: {dir_name}...")
        stats = extract_and_calculate(zip_file_path)
        results.append({"dir_name": dir_name, "zip_filename": zip_filename, "stats": stats})  # Include zip_filename in results

    return results

def generate_markdown_table(results):
    headers = ["Directory", "ZIP Filename", "Min", "Max", "Median", "25th percentile", "50th percentile", "75th percentile", "99th percentile", "99.9th percentile", "99.99th percentile", "99.999th percentile", "JSON File Count"]
    table = []
    table.append("| " + " | ".join(headers) + " |")
    table.append("| " + " | ".join("---" for _ in headers) + " |")

    for result in results:
        dir_name = result["dir_name"]
        zip_filename = result["zip_filename"]  # Get the ZIP filename from the result

        row = [
            dir_name,
            zip_filename,  # Add the ZIP filename to the row
            str(result["stats"]["min"]),
            str(result["stats"]["max"]),
            str(result["stats"]["median"]),
            str(result["stats"]["25th percentile"]),
            str(result["stats"]["50th percentile"]),
            str(result["stats"]["75th percentile"]),
            str(result["stats"]["99th percentile"]),
            str(result["stats"]["99.9th percentile"]),
            str(result["stats"]["99.99th percentile"]),
            str(result["stats"]["99.999th percentile"]),
            str(result["stats"]["json_file_count"])
        ]
        table.append("| " + " | ".join(row) + " |")

    return "\n".join(table)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python process_json.py <path_to_directory>")
        sys.exit(1)

    directory_path = sys.argv[1]
    aggregated_results = process_directory(directory_path)
    print(generate_markdown_table(aggregated_results))
