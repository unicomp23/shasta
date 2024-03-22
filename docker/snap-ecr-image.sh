#!/bin/bash

# Ensure the ECR repository URL is provided
if [ -z "$ECR_REPOSITORY_URL" ]; then
  echo "ECR_REPOSITORY_URL environment variable is not set."
  exit 1
fi

# Define the name of the Docker container you want to snap
CONTAINER_NAME="shasta-shasta"

# Define a tag for the snapshot, you can customize this as needed
SNAPSHOT_TAG="latest"

# Create a snapshot of the running container
docker commit $(docker ps -qf "name=$CONTAINER_NAME") ${CONTAINER_NAME}:${SNAPSHOT_TAG}

# Authenticate Docker to the ECR repository
aws ecr get-login-password --region $(echo $ECR_REPOSITORY_URL | cut -d'.' -f4) | docker login --username AWS --password-stdin $(echo $ECR_REPOSITORY_URL | cut -d'/' -f1)

# Tag the snapshot for the ECR repository
docker tag ${CONTAINER_NAME}:${SNAPSHOT_TAG} ${ECR_REPOSITORY_URL}:${SNAPSHOT_TAG}

# Push the snapshot to the ECR repository
docker push ${ECR_REPOSITORY_URL}:${SNAPSHOT_TAG}

echo "Snapshot of ${CONTAINER_NAME} pushed to ${ECR_REPOSITORY_URL} with tag ${SNAPSHOT_TAG}"
