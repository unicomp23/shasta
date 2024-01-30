# List all EC2 instances with the tag "Role=worker"
instances=$(aws ec2 describe-instances --filters "Name=tag:Role,Values=worker" --query "Reservations[*].Instances[*].PublicIpAddress" --output text --region us-east-1)

# Loop over the instances
for ip in $instances
do
  # Create a directory for each IP
  mkdir -p ~/tmp/loadtest/$ip

  # Copy the file from each instance into its respective directory
  scp -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem ec2-user@$ip:tmp/instrumentation.json ~/tmp/loadtest/$ip/

  # Copy the log.test.txt file from each instance into its respective directory
  scp -o StrictHostKeyChecking=no -i ~/Downloads/john.davis.keypair.pem ec2-user@$ip:tmp/log.test.txt ~/tmp/loadtest/$ip/
done
