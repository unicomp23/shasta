#!/bin/bash

# Get the list of instance IDs
instances=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" "Name=tag:Role,Values=worker" --query "Reservations[*].Instances[*].InstanceId" --output text --region us-east-1)

# Convert the list of instance IDs into an array
instance_array=($instances)

# Print out the number of instances
echo "Number of instances: ${#instance_array[@]}"

# Define the size of each batch
batch_size=20

# Calculate the number of batches
num_batches=$(((${#instance_array[@]} + batch_size - 1) / batch_size))

# Print out the number of batches
echo "Number of batches: $num_batches"

# Loop over the batches
for ((batch=0; batch<$num_batches; batch++))
do
  # Calculate the start and end indices for this batch
  start=$((batch * batch_size))
  end=$((start + batch_size - 1))

  # Get the instance IDs for this batch
  batch_instances=("${instance_array[@]:$start:$batch_size}")

  # Print out the instance IDs in this batch
  echo "Batch $batch: ${batch_instances[@]}"

  # Send the command to the instances in this batch
  aws ssm send-command \
      --region us-east-1 \
      --document-name "AWS-RunShellScript" \
      --parameters 'commands=["sudo -u ec2-user -i /bin/bash -c \"mkdir -p ~/tmp && cd ~/repo/ShastaCdkRepo/shasta && npm i && npx ts-node src/lib/pubsub/loadtest.ts > ~/tmp/log.test.txt 2>&1\""]' \
      --instance-ids "${batch_instances[@]}" >/dev/null 2>&1

  # Sleep for 1 second before moving on to the next batch
  sleep 1
done
