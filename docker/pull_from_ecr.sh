#!/bin/bash

# Check if at least one argument is provided (image tag)
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <image_tag>"
    exit 1
fi

IMAGE_TAG=$1

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

if [ $? -eq 0 ]; then
    echo "Docker image pulled successfully."
else
    echo "Error pulling Docker image."
fi
