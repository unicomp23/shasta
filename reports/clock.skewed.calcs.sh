#!/bin/bash

# Ensure that exactly one argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 path/to/directory"
    exit 1
fi

DIRECTORY_PATH="$1"

# Call the Python script with the directory path
python3 process.instrumentation.clock.skewed.py "$DIRECTORY_PATH"
