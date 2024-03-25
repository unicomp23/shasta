#!/bin/bash

# Check if SHASTA_CDK_ECR_REPO_URI is set
if [ -z "$SHASTA_CDK_ECR_REPO_URI" ]; then
    echo "SHASTA_CDK_ECR_REPO_URI is not set. Please set it to the ECR repository URI."
    exit 1
fi

# Extract AWS_ACCOUNT_ID and AWS_REGION from ECR_REPO_URI
ECR_REPO_URI=$SHASTA_CDK_ECR_REPO_URI # Use the environment variable
AWS_ACCOUNT_ID=$(echo $ECR_REPO_URI | cut -d. -f1)
AWS_REGION=$(echo $ECR_REPO_URI | cut -d. -f4)

# Authenticate Docker to the ECR Registry
echo "Authenticating Docker to the ECR Registry..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

# Build and push shasta-awslinux image
echo "Building and pushing shasta-awslinux image..."
docker-compose build shasta
docker-compose push shasta

# Build and push shasta-devenv image
echo "Building and pushing shasta-devenv image..."
docker-compose build shasta-devenv
docker-compose push shasta-devenv

echo "Images pushed successfully."
