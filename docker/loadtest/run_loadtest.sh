#!/bin/bash

# Check if the correct number of arguments is provided
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <n> <image_tag>"
    echo "  <n>         : Number of loadtest instances to scale up"
    echo "  <image_tag> : Image tag for the loadtest container to pull from ECR"
    exit 1
fi

N=$1 # Number of instances
IMAGE_TAG=$2 # Image tag for the loadtest container

# Export N so it's available as an environment variable
export N

# Ensure SHASTA_CDK_ECR_REPO_URI is set
if [ -z "$SHASTA_CDK_ECR_REPO_URI" ]; then
    echo "The SHASTA_CDK_ECR_REPO_URI environment variable is not set."
    exit 1
fi

# Extract the AWS region from the ECR repository URI
AWS_REGION=$(echo $SHASTA_CDK_ECR_REPO_URI | cut -d. -f4)

# Authenticate Docker with AWS ECR
echo "Authenticating Docker with AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $SHASTA_CDK_ECR_REPO_URI

# Pull the Docker image from ECR
FULL_IMAGE_URI="$SHASTA_CDK_ECR_REPO_URI:$IMAGE_TAG"
echo "Pulling Docker image from ECR: $FULL_IMAGE_URI"
docker pull $FULL_IMAGE_URI

if [ $? -ne 0 ]; then
    echo "Error pulling Docker image."
    exit 1
fi

# Use the environment variable in the docker compose command
docker-compose up --scale loadtest=$N
