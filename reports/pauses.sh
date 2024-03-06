#!/bin/bash

# Check if an argument was provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_directory>"
    exit 1
fi

DIRECTORY_PATH="$1"

# Invoke the Python script with the directory path
python process.pauses.py "$DIRECTORY_PATH"
