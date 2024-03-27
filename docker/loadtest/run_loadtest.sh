#!/bin/bash

# Check if the correct number of arguments is provided
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <n>"
    exit 1
fi

N=$1 # Number of instances

# Export N so it's available as an environment variable
export N

# Use the environment variable in the docker compose command
docker-compose up --scale loadtest=$N
