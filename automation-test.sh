#!/bin/bash
set -e
set -x
env
base="$(pwd)"

[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
nvm install 16.16.0

rm -rf media-ansible
git clone git@github.com:airtimemedia/media-ansible.git

# generate config file
AWS_PROFILE=eng ansible-playbook media-ansible/shasta_automation_config.yml -e "env_override=${NODE_NAME} shasta_config_destination=${base}/shasta-automation.conf"

export AUTOMATION_APP_CONFIG=${base}/shasta-automation.conf
cat ${AUTOMATION_APP_CONFIG}

cd shasta
GIT_SSH_COMMAND=ssh npm ci
npm test
