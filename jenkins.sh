#!/bin/bash

set -e
set -x
export BUILD_NUMBER=${actual_build_number}
env
. ~/.nvm/nvm.sh
# this value should match the one in CMakeLists.txt, but
# don't include the epoch "2:"
# set(AIRTIME_NODE_VERSION "2:16.16.0")
nvm install 16.16.0

top=$(pwd)
make init
make update
(cd ${top}/shasta;GIT_SSH_COMMAND=ssh npm ci)
make shasta-package-setup
make release-rpm release-config-rpm > rpm.log 2>&1

# create version prop file for downstream job
echo "VERSION_BASE=$(cat ShastaWorkerVersion.txt)" > version.prop
