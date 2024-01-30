#!/bin/bash

# Check if a directory argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_directory>"
    exit 1
fi

# Directory containing the zip files
DIR=$1

# Check if the directory exists
if [ ! -d "$DIR" ]; then
    echo "Directory not found: $DIR"
    exit 1
fi

# Iterate over all zip files in the directory
for zipfile in "$DIR"/*.zip; do
    # Check if the file exists
    if [ ! -f "$zipfile" ]; then
        continue
    fi

    echo "Processing file: $zipfile"
    # Call run.sh script with the zip file
    ./run.sh "$zipfile"
done
