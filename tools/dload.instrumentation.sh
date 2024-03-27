# List all EC2 instances with the tag "Role=worker"
instances=$(aws ec2 describe-instances --filters "Name=tag:Role,Values=worker" --query "Reservations[*].Instances[*].PublicIpAddress" --output text --region us-east-1)

# Loop over the instances
for ip in $instances
do
  # Create a directory for each IP
  mkdir -p ~/tmp/loadtest/$ip

  # Copy all files matching instrumentation*.json from each instance into its respective directory using rsync
  rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem" ec2-user@$ip:/tmp/instrumentation*.json ~/tmp/loadtest/$ip/
  # Copy all files matching log* from each instance into its respective directory using rsync
  rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem" ec2-user@$ip:/tmp/log* ~/tmp/loadtest/$ip/
  # Copy all files matching eventLoopPauses* from each instance into its respective directory using rsync
  rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem" ec2-user@$ip:/tmp/eventLoopPauses* ~/tmp/loadtest/$ip/
done
# List all EC2 instances with the tag "SubRole=consumer"
consumer_instances=$(aws ec2 describe-instances --filters "Name=tag:SubRole,Values=consumer" --query "Reservations[*].Instances[*].PublicIpAddress" --output text --region us-east-1)

# Loop over the consumer instances
for ip in $consumer_instances
do
  # Create a directory for each IP
  mkdir -p ~/tmp/loadtest/$ip

  # Copy all files matching instrumentation*.json from each consumer instance into its respective directory using rsync
  rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem" ec2-user@$ip:/tmp/instrumentation*.json ~/tmp/loadtest/$ip/
  # Copy all files matching log* from each consumer instance into its respective directory using rsync
  rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem" ec2-user@$ip:/tmp/log* ~/tmp/loadtest/$ip/
  # Copy all files matching eventLoopPauses* from each consumer instance into its respective directory using rsync
  rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem" ec2-user@$ip:/tmp/eventLoopPauses* ~/tmp/loadtest/$ip/
done
