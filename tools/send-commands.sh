#!/bin/bash

# Define NODE_OPTIONS outside the loops
export NODE_OPTIONS="--max-old-space-size=16384 --expose-gc"

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
      --parameters "{\"commands\":[\"sudo -u ec2-user -i /bin/bash -c 'mkdir -p ~/tmp && cd ~/repo/ShastaCdkRepo/shasta && npm i && npx ts-node src/lib/pubsub/loadtest.ts > /tmp/log.test.txt 2>&1'\"]}" \
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
      --parameters "{\"commands\":[\"sudo -u ec2-user -i /bin/bash -c 'mkdir -p ~/tmp && cd ~/repo/ShastaCdkRepo/shasta && npm i && npx ts-node src/lib/pubsub/loadtest.ts > /tmp/log.test.txt 2>&1'\"]}" \
      --instance-ids "$instance" \
      --timeout-seconds 86400 >/dev/null 2>&1
  sleep 0.05
done
