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
file(STRINGS "ShastaVersion.txt" SHASTA_BASE_VERSION)
project(shasta)

if(NOT ${at_deps_dir})
  set(${at_deps_dir} deps)
endif()

include("${at_deps_dir}/cmake/deps.cmake")

if (vline_lib_install_dir)
  install(DIRECTORY ${PROJECT_BINARY_DIR}/shasta
    DESTINATION ${vline_lib_install_dir}
    COMPONENT shasta
  )

  add_rpm_target(ASSOCIATED_PROJECT shasta
      COMPONENT shasta
      COMPONENT_VERSION "${SHASTA_BASE_VERSION}"
      RPM_DEPENDS  "nodejs = ${AIRTIME_NODE_VERSION}"
      DESCRIPTION "shasta"
  )

  add_rpm_target(ASSOCIATED_PROJECT shasta
      COMPONENT shasta-config
      COMPONENT_VERSION "${SHASTA_BASE_VERSION}"
      DESCRIPTION "shasta config"
  )

  install_config_only(SCRIPT_NAME shasta
    LOCAL_CONFIG_NAME shasta.json.j2
    EXE_PARAMS ""
    COMPONENT shasta-config
  )

  install_config_only(SCRIPT_NAME shasta
    LOCAL_CONFIG_NAME settings.js.j2
    EXE_PARAMS ""
    COMPONENT shasta-config
  )
endif()
