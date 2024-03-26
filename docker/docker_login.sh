#!/bin/bash

# Check if SHASTA_CDK_ECR_REPO_URI is set
if [ -z "$SHASTA_CDK_ECR_REPO_URI" ]; then
    echo "SHASTA_CDK_ECR_REPO_URI is not set. Please set it to the ECR repository URI."
    exit 1
fi

# Variables
ECR_REPO_URI=$SHASTA_CDK_ECR_REPO_URI # Use the environment variable

# Extract AWS_ACCOUNT_ID and AWS_REGION from ECR_REPO_URI
AWS_ACCOUNT_ID=$(echo $ECR_REPO_URI | cut -d. -f1)
AWS_REGION=$(echo $ECR_REPO_URI | cut -d. -f4)

# Authenticate Docker to the ECR Registry
echo "Authenticating Docker to the ECR Registry..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI

echo "Docker authenticated successfully to the ECR Registry."
