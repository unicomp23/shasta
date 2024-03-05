#!/bin/bash

# Check if a directory path is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <directory_path>"
    exit 1
fi

# Assign the provided directory path to a variable
DIR_PATH=$1

# Check if the provided path is a directory
if [ ! -d "$DIR_PATH" ]; then
    echo "Error: The path provided is not a directory."
    exit 1
fi

# Use find to locate all eventLoopPauses.json files in the directory and its subdirectories
# and zip them into pauses.zip
find "$DIR_PATH" -type f -name "eventLoopPauses.json" -exec zip pauses.zip {} +

echo "All eventLoopPauses.json files have been zipped into pauses.zip."
