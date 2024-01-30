#!/bin/bash

# Check if an argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_zip_file>"
    exit 1
fi

# Path to the Python script
PYTHON_SCRIPT="process_json.py"

# Call the Python script with the zip file path
python $PYTHON_SCRIPT "$1"
