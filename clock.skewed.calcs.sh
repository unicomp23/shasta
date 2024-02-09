#!/bin/bash

# Ensure that exactly one argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 path/to/directory"
    exit 1
fi

DIRECTORY_PATH="$1"

# Find all zip files recursively in the directory and process each one
find "$DIRECTORY_PATH" -type f -name '*.zip' | while read ZIP_PATH; do
    echo "Processing $ZIP_PATH"
    python3 process.instrumentation.clock.skewed.py "$ZIP_PATH"
done
