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
REPO_NAME=$(echo $ECR_REPO_URI | rev | cut -d/ -f1 | rev)

# Delete all images in ECR repository
aws ecr list-images --repository-name $REPO_NAME --region $AWS_REGION --query 'imageIds[*]' --output json | \
aws ecr batch-delete-image --repository-name $REPO_NAME --region $AWS_REGION --image-ids file:///dev/stdin
