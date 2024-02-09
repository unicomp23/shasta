import json
import zipfile
import numpy as np
import sys
import os
# Import the calculate_differences_and_stats function from the other script
from process_instrumentation_clock_skewed import calculate_differences_and_stats

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

    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith(".zip"):
                zip_file_path = os.path.join(root, file)
                zip_files.append(zip_file_path)

    for zip_file_path in zip_files:
        dir_name = os.path.basename(os.path.dirname(zip_file_path))
        stats = extract_and_calculate(zip_file_path)
        
        # Here you would generate or specify the path to your intermediate JSON
        # For demonstration, let's assume it's already compatible
        intermediate_json_path = '/tmp/instrumentation.intermediate.json'
        d_stats = calculate_differences_and_stats(intermediate_json_path)
        
        # Integrate D2-D5 stats into your results
        stats.update(d_stats)
        
        results.append({"dir_name": dir_name, "stats": stats})

    return results

def generate_markdown_table(results):
    headers = ["Directory", "Min", "Max", "Median", "25th percentile", "50th percentile", "75th percentile", "99th percentile", "99.9th percentile", "99.99th percentile", "99.999th percentile", "JSON File Count", "D2", "D3", "D4", "D5"]
    table = []
    table.append("| " + " | ".join(headers) + " |")
    table.append("| " + " | ".join("---" for _ in headers) + " |")

    for result in results:
        dir_name = result["dir_name"]

        row = [
            dir_name,
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
            str(result["stats"]["json_file_count"]),
            str(result["stats"].get("D2", "N/A")),  # Assuming D2-D5 stats are added to the results dictionary
            str(result["stats"].get("D3", "N/A")),
            str(result["stats"].get("D4", "N/A")),
            str(result["stats"].get("D5", "N/A"))
        ]
        table.append("| " + " | ".join(row) + " |")

    return "\n".join(table)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_instrumentation_round_trip.py <path_to_directory>")
        sys.exit(1)

    directory_path = sys.argv[1]
    results = process_directory(directory_path)
    markdown_table = generate_markdown_table(results)
    print(markdown_table)
