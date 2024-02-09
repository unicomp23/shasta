#!/bin/bash

# Ensure that exactly one argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 path/to/zipfile.zip"
    exit 1
fi

ZIP_PATH="$1"

# Replace the path below with the actual path to your process_instrumentation.py script
python3 process.instrumentation.clock.skewed.py "$ZIP_PATH"
