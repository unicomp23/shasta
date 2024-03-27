#!/bin/bash

# Get the list of instance IDs for the workers
instances=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" "Name=tag:Role,Values=worker" --query "Reservations[*].Instances[*].InstanceId" --output text --region us-east-1)

# Convert the list of instance IDs into an array
instance_array=($instances)

# Print out the number of instances
echo "Number of workers: ${#instance_array[@]}"

# Loop over the instances
for instance in "${instance_array[@]}"
do
  # Log the instance ID
  echo "Sending command to instance: $instance"
  # Send the command to the instance
  aws ssm send-command \
      --region us-east-1 \
      --document-name "AWS-RunShellScript" \
      --parameters "{\"commands\":[\"sudo -u ec2-user -i /bin/bash -c \\\"mkdir -p ~/tmp && cd ~/repo/ShastaCdkRepo/shasta && npm i && NODE_OPTIONS=--max-old-space-size=65536 npx --exposes-gc ts-node src/lib/pubsub/loadtest.ts > /tmp/log-$(uuidgen).test.txt 2>&1\\\"\"]}" \
      --instance-ids "$instance" \
      --timeout-seconds 86400 >/dev/null 2>&1
  # Sleep for 50ms before moving on to the next instance
  sleep 0.05
done

# Get the list of instance IDs for the consumers
instances=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" "Name=tag:SubRole,Values=consumer" --query "Reservations[*].Instances[*].InstanceId" --output text --region us-east-1)

# Convert the list of instance IDs into an array
instance_array=($instances)

# Print out the number of instances
echo "Number of consumers: ${#instance_array[@]}"

# Loop over the instances
for instance in "${instance_array[@]}"
do
  # Log the instance ID and command number
  echo "Sending command to instance: $instance"
  # Send the command to the instance
  aws ssm send-command \
      --region us-east-1 \
      --document-name "AWS-RunShellScript" \
      --parameters "{\"commands\":[\"sudo -u ec2-user -i /bin/bash -c \\\"mkdir -p ~/tmp && cd ~/repo/ShastaCdkRepo/shasta && npm i && NODE_OPTIONS=--max-old-space-size=65536 npx --exposes-gc ts-node src/lib/pubsub/loadtest.ts > /tmp/log-$(uuidgen).test.txt 2>&1\\\"\"]}" \
      --instance-ids "$instance" \
      --timeout-seconds 86400 >/dev/null 2>&1
  # Sleep for 50ms before sending the next command
  sleep 0.05
done
