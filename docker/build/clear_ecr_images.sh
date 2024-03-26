#!/bin/bash

# Disable the pager in AWS CLI
export AWS_PAGER=""

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

# Get list of image IDs
IMAGE_IDS=$(aws ecr list-images --repository-name $REPO_NAME --region $AWS_REGION --query 'imageIds[*]' --output json)

# Check if there are images to delete
if [ "$IMAGE_IDS" == "[]" ]; then
    echo "No images to delete in ECR repository $REPO_NAME."
    exit 0
fi

# Delete all images in ECR repository
echo "Deleting all images in ECR repository $REPO_NAME..."
aws ecr batch-delete-image --repository-name $REPO_NAME --region $AWS_REGION --image-ids "$IMAGE_IDS"

echo "All images deleted successfully."
