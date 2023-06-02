# Copyright Airtime Media 2022

# We were seeing errors on OSX occasionally unless
# using version specified below. Other platforms seem
# to work with older versions.
cmake_minimum_required(VERSION 3.15.3)

# The 2: at the beginning of the version is the epoch number. It will
# generally stay the same (it's been 2: for 7,8,9).
# https://ask.fedoraproject.org/en/question/6987/whats-the-meaning-of-the-number-which-appears-sometimes-when-i-use-yum-to-install-a-fedora-package-before-a-colon-at-the-beginning-of-the-name-of-the/
# The epoch is part the rpm metadata. With yum, you can see it with:
# yum info nodejs-16.16.0
set(AIRTIME_NODE_VERSION "2:16.16.0")
file(STRINGS "ShastaWorkerVersion.txt" SHASTA_WORKER_BASE_VERSION)
project(shasta-worker)

if(NOT ${at_deps_dir})
  set(${at_deps_dir} deps)
endif()

include("${at_deps_dir}/cmake/deps.cmake")

if (vline_lib_install_dir)
  install(DIRECTORY ${PROJECT_BINARY_DIR}/shasta
    DESTINATION ${vline_lib_install_dir}
    PERMISSIONS OWNER_EXECUTE OWNER_WRITE OWNER_READ GROUP_EXECUTE GROUP_READ
                WORLD_EXECUTE WORLD_READ
    COMPONENT shasta-worker
  )

  add_rpm_target(ASSOCIATED_PROJECT shasta-worker
      COMPONENT shasta-worker
      COMPONENT_VERSION "${SHASTA_WORKER_BASE_VERSION}"
      RPM_DEPENDS  "nodejs = ${AIRTIME_NODE_VERSION}"
      DESCRIPTION "shasta-worker"
  )

  add_rpm_target(ASSOCIATED_PROJECT shasta-worker
      COMPONENT shasta-worker-config
      COMPONENT_VERSION "${SHASTA_WORKER_BASE_VERSION}"
      DESCRIPTION "shasta-worker config"
  )

  install_config_only(SCRIPT_NAME shasta-worker
    LOCAL_CONFIG_NAME shasta-worker.json.j2
    EXE_PARAMS ""
    COMPONENT shasta-worker-config
  )

  install_config_only(SCRIPT_NAME shasta-worker
    LOCAL_CONFIG_NAME settings.js.j2
    EXE_PARAMS ""
    COMPONENT shasta-worker-config
  )
endif()
