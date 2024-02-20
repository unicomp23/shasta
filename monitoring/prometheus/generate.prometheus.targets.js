const fs = require('fs');
const path = require('path');

// Load the example targets
const exampleTargetsPath = path.join(__dirname, 'targets.example.json');
const exampleTargets = JSON.parse(fs.readFileSync(exampleTargetsPath, 'utf8'));

// Extract brokers from the BOOTSTRAP_BROKERS environment variable
const bootstrapBrokers = process.env.BOOTSTRAP_BROKERS.split(',');

// Function to replace hostnames in the targets
function updateTargets(targets, newHosts) {
  return targets.map(target => {
    const [oldHost, port] = target.split(':');
    const newHost = newHosts.find(host => host.includes(oldHost.split('.')[0]));
    return `${newHost}:${port}`;
  });
}

// Update each target group in the example with new hostnames
const updatedTargets = exampleTargets.map(group => {
  const newHosts = bootstrapBrokers.map(broker => broker.split(':')[0]);
  return {
    ...group,
    targets: updateTargets(group.targets, newHosts)
  };
});

// Write the updated targets to targets.json
const updatedTargetsPath = path.join(__dirname, 'targets.json');
fs.writeFileSync(updatedTargetsPath, JSON.stringify(updatedTargets, null, 2));

console.log('targets.json has been generated successfully.');
