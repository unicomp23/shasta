#!/bin/bash

# Check if an argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: ./iter.sh <path_to_directory>"
    exit 1
fi

# Run the Python script with the provided directory
python3 process_json.py "$1"
