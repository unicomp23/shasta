import sys
import json
import numpy as np
import os
import re
from zipfile import ZipFile

def extract_and_process_data(zip_path):
    # Initialize the dictionary with the ">1000" bucket to ensure it's always included
    pause_durations_buckets = {">1000": 0}
    with ZipFile(zip_path, 'r') as zip_ref:
        pattern = re.compile(r'.*/eventLoopPauses\.json$', re.IGNORECASE)
        for file_info in zip_ref.infolist():
            if pattern.match(file_info.filename):
                print(f"Processing JSON file: {file_info.filename}")
                delta_count = 0  # Initialize counter for delta entries
                with zip_ref.open(file_info.filename) as file:
                    file_content = file.read().decode('utf-8', 'ignore')
                    try:
                        data = json.loads(file_content)
                        # Process each item in the data list
                        for item in data:
                            delta = item.get("delta", 0)
                            # Check if delta is greater than 5 milliseconds
                            if delta > 5:
                                # Determine the bucket for this delta
                                if delta > 1000:
                                    bucket = ">1000"
                                    pause_durations_buckets[bucket] = pause_durations_buckets.get(bucket, 0) + 1
                                else:
                                    # Adjust bucketing to ensure the first bucket starts from 6ms
                                    if delta >= 6:
                                        lower_bound = int((delta - 6) // 100) * 100 + 6
                                        upper_bound = lower_bound + 99
                                        bucket = f"{lower_bound}-{upper_bound}"
                                        pause_durations_buckets[bucket] = pause_durations_buckets.get(bucket, 0) + 1
                                delta_count += 1  # Increment counter for each delta processed
                    except json.decoder.JSONDecodeError:
                        print(f"Error processing file: {file_info.filename}")
                # Log the count of delta entries processed for this file
                print(f"Delta entries processed for {file_info.filename}: {delta_count}")

    return pause_durations_buckets

# The rest of the functions (calculate_statistics) remain unchanged

def generate_github_markdown_table(pause_durations_buckets):
    # Start with the header row
    table = "| Interval (ms) | Count |\n"
    table += "|---------------|-------|\n"
    # Ensure the ">1000" bucket is sorted correctly
    sorted_keys = sorted(pause_durations_buckets.keys(), key=lambda x: int(x.split('-')[0]) if '-' in x else float('inf'))
    for bucket in sorted_keys:
        count = pause_durations_buckets[bucket]
        # Use backticks for the ">1000" bucket to ensure it's treated as a literal string
        bucket_display = f"`{bucket}`" if bucket == ">1000" else bucket
        table += f"| {bucket_display} | {count} |\n"
    return table

def process_directory(directory_path):
    print(f"Processing directory: {directory_path}")
    pause_durations_buckets = extract_and_process_data(directory_path)
    print("Event Loop Pause Statistics:")
    print(generate_github_markdown_table(pause_durations_buckets))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_event_loop_pauses.py <path_to_directory>")
        sys.exit(1)

    directory_path = sys.argv[1]
    process_directory(directory_path)
    