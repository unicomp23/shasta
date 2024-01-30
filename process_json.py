import json
import zipfile
import numpy as np
import sys

def extract_and_calculate(zip_path):
    differences = []
    with zipfile.ZipFile(zip_path, 'r') as z:
        for filename in z.namelist():
            if filename.endswith('.json'):
                with z.open(filename) as f:
                    data = json.load(f)
                    for timestamps in data.get('timestamps', {}).values():
                        before_publish = timestamps.get('beforePublish')
                        after_subscribe_xread_delta = timestamps.get('afterSubscribeXReadDelta')
                        if before_publish and after_subscribe_xread_delta:
                            difference = after_subscribe_xread_delta - before_publish
                            differences.append(difference)

    differences_array = np.array(differences)
    stats = {
        "min": np.min(differences_array),
        "max": np.max(differences_array),
        "median": np.median(differences_array),
        "25th percentile": np.percentile(differences_array, 25),
        "50th percentile": np.percentile(differences_array, 50),
        "75th percentile": np.percentile(differences_array, 75),
        "99th percentile": np.percentile(differences_array, 99),
        "99.9th percentile": np.percentile(differences_array, 99.9),
        "99.99th percentile": np.percentile(differences_array, 99.99),
        "99.999th percentile": np.percentile(differences_array, 99.999)
    }
    return stats

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python process_json.py <path_to_zip_file>")
        sys.exit(1)
    
    zip_file_path = sys.argv[1]
    stats = extract_and_calculate(zip_file_path)
    print(stats)
