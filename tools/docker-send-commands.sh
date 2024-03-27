#!/bin/bash

# Check if an argument was provided
if [ "$#" -ne 1 ]; then
    echo "Error: Missing required argument."
    echo "Usage: $0 <N>"
    echo "Where <N> is the number of instances to use in the load test."
    echo "Example: $0 5"
    exit 1
fi

N=$1 # Number of instances to use in the load test

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
  # Send the command to the instance with the new log filename
  aws ssm send-command \
      --region us-east-1 \
      --document-name "AWS-RunShellScript" \
      --parameters "{\"commands\":[\"sudo -u ec2-user -i /bin/bash -c 'cd ~/repo/ShastaCdkRepo/docker/loadtest && ./run_loadtest.sh $N shasta-awslinux > /tmp/log-$(uuidgen).test.txt 2>&1'\"], \"executionTimeout\":[\"86400\"]}" \
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
  # Log the instance ID
  echo "Sending command to instance: $instance"
  # Send the command to the instance with the new log filename
  aws ssm send-command \
      --region us-east-1 \
      --document-name "AWS-RunShellScript" \
      --parameters "{\"commands\":[\"sudo -u ec2-user -i /bin/bash -c 'cd ~/repo/ShastaCdkRepo/docker/loadtest && ./run_loadtest.sh $N shasta-awslinux > /tmp/log-$(uuidgen).test.txt 2>&1'\"], \"executionTimeout\":[\"86400\"]}" \
      --instance-ids "$instance" \
      --timeout-seconds 86400 >/dev/null 2>&1
  # Sleep for 50ms before moving on to the next instance
  sleep 0.05
done
