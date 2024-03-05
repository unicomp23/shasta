#!/bin/bash

# Check if a path argument was provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path>"
    exit 1
fi

# Assign the provided argument to a variable
SEARCH_PATH=$1

# Find all .json files, validate JSON formatting, and echo the filename
find "$SEARCH_PATH" -name "*.json" -exec sh -c 'jq empty "{}" 2>/dev/null && echo "{}" || echo "Invalid JSON in: {}"' \;
