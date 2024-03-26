#!/bin/bash

# Check if SHASTA_CDK_ECR_REPO_URI is set
if [ -z "$SHASTA_CDK_ECR_REPO_URI" ]; then
    echo "SHASTA_CDK_ECR_REPO_URI is not set. Please set it to the ECR repository URI."
    exit 1
fi

# Check if an image tag is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <image_tag>"
    exit 1
fi

# Variables
IMAGE_REPO=$SHASTA_CDK_ECR_REPO_URI # Use the environment variable
IMAGE_TAG=$1 # Get the first command-line argument

# Check if the Docker image with the provided tag exists
if ! docker image inspect $IMAGE_REPO:$IMAGE_TAG &> /dev/null; then
    echo "Docker image with tag $IMAGE_TAG does not exist in the ECR repository."
    exit 1
fi

# Run Docker image
docker run --rm -it $IMAGE_REPO:$IMAGE_TAG bash
