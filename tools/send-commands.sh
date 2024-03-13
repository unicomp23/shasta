#!/bin/bash

# Command for workers
WORKER_COMMAND="export NODE_OPTIONS='--max-old-space-size=32768' && mkdir -p ~/tmp && cd ~/repo/ShastaCdkRepo/shasta && npm i && node --expose-gc -r ts-node/register src/lib/pubsub/loadtest.ts > /tmp/log.test.txt 2>&1"

# Command for consumers
CONSUMER_COMMAND="export NODE_OPTIONS='--max-old-space-size=32768' && mkdir -p ~/tmp && cd ~/repo/ShastaCdkRepo/shasta && npm i && node --expose-gc -r ts-node/register src/lib/pubsub/loadtest.ts > /tmp/log.test.txt 2>&1"

# Get the list of instance IDs for the workers
instances=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" "Name=tag:Role,Values=worker" --query "Reservations[*].Instances[*].InstanceId" --output text --region us-east-1)

# Convert the list of instance IDs into an array
instance_array=($instances)

# Print out the number of instances
echo "Number of workers: ${#instance_array[@]}"

# Loop over the instances for workers
for instance in "${instance_array[@]}"
do
  echo "Sending command to instance: $instance"
  aws ssm send-command \
      --region us-east-1 \
      --document-name "AWS-RunShellScript" \
      --parameters "{\"commands\":[\"$WORKER_COMMAND\"]}" \
      --instance-ids "$instance" \
      --timeout-seconds 86400 >/dev/null 2>&1
  sleep 0.05
done

# Get the list of instance IDs for the consumers
instances=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" "Name=tag:SubRole,Values=consumer" --query "Reservations[*].Instances[*].InstanceId" --output text --region us-east-1)

# Convert the list of instance IDs into an array
instance_array=($instances)

# Print out the number of instances
echo "Number of consumers: ${#instance_array[@]}"

# Loop over the instances for consumers
for instance in "${instance_array[@]}"
do
  echo "Sending command to instance: $instance"
  aws ssm send-command \
      --region us-east-1 \
      --document-name "AWS-RunShellScript" \
      --parameters "{\"commands\":[\"$CONSUMER_COMMAND\"]}" \
      --instance-ids "$instance" \
      --timeout-seconds 86400 >/dev/null 2>&1
  sleep 0.05
done
