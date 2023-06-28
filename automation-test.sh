#!/bin/bash
set -e
set -x
env
base="$(pwd)"

rm -rf media-ansible
git clone git@github.com:airtimemedia/media-ansible.git

# generate config file
AWS_PROFILE=eng ansible-playbook media-ansible/shasta_automation_config.yml -e "env_override=${NODE_NAME} shasta_config_destination=${base}/shasta-automation.conf"
