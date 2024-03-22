#!/bin/bash

# Build the Docker image
docker build -t shasta-base -f ./Dockerfile .

# Push the Docker image to ECR
echo "Pushing the Docker image to ECR..."
./push_to_ecr.sh shasta-base
