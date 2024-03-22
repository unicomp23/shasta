#!/bin/bash

# Check if an image tag is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <image_tag>"
    exit 1
fi

# Variables
IMAGE_TAG=$1
ECR_REPO_URI=$SHASTA_CDK_ECR_REPO_URI # Use the environment variable

# Extract AWS_ACCOUNT_ID and AWS_REGION from ECR_REPO_URI
AWS_ACCOUNT_ID=$(echo $ECR_REPO_URI | cut -d. -f1)
AWS_REGION=$(echo $ECR_REPO_URI | cut -d. -f4)

# Authenticate Docker to the ECR Registry
echo "Authenticating Docker to the ECR Registry..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

# Tag the Docker image
echo "Tagging the Docker image..."
docker tag $IMAGE_TAG $ECR_REPO_URI:$IMAGE_TAG

# Push the Image to ECR
echo "Pushing the Docker image to ECR..."
docker push $ECR_REPO_URI:$IMAGE_TAG

echo "Image pushed successfully."
