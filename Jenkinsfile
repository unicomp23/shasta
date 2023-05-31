#!groovy

@Library('airtime-pipeline-library@pipeline-library-1.0.23') _

def buildOnNode(nodeName, platform) {
  node("${nodeName}") {

    timestamps { timeout(80) {
      deleteDir()           // make sure working directory is clean

      def commit = helpers.getGitCommit()

      // Tell GitHub that the build is pending
      external.reportGitHubStatus("${platform}", commit, "pending", "Building")

      // Checks out commit that corresponds to this Jenkinsfile
      // See https://support.cloudbees.com/hc/en-us/articles/226122247-How-to-Customize-Checkout-for-Pipeline-Multibranch
      checkout([
          $class: 'GitSCM',
          branches: scm.branches,
          doGenerateSubmoduleConfigurations: scm.doGenerateSubmoduleConfigurations,
          extensions: scm.extensions + [[$class: 'CloneOption', depth: 0, noTags: false, reference: env.HOME + '/git-cache', shallow: false, timeout: 20]],
          userRemoteConfigs: scm.userRemoteConfigs
      ])

      try {
        def actual_build_number = build_helpers.getActualBuildNumber()

        sshagent(['b1214ac2-1a8e-4fae-8b0b-4d00327ccaa0']) {
          withEnv(["actual_build_number=${actual_build_number}"]) {
            sh "./jenkins.sh"
          }
        }

        buildDir = 'build/linux-x86_64-release'
        stash includes: "${buildDir}/*.rpm", name: 'rpms'
        step([$class: 'ArtifactArchiver', artifacts: "${buildDir}/*.rpm, rpm.log", excludes: null, fingerprint: true])

      } catch (java.lang.Exception e) {
        // Tell GitHub that the build failed
        external.reportGitHubStatus("${platform}", commit, "failure", "Build failed")
        throw e
      }

      // Tell GitHub that the build succeeded
      external.reportGitHubStatus("${platform}", commit, "success", "Successfully built")

      // DEVOPS-933: clean up workspace directory since it won't be deleted
      // automatically when the job is deleted
      if (branch.isFeatureBranch()) {
        deleteDir()
      }
    } }
  }
}

def deployUrl

def buildTimes = [:]

// stash all important git variables
baseVersionFile = 'ShastaVersion.txt'
helpers.stashImportantVars(baseVersionFile)

if (branch.isPR()) {
  def commit = helpers.getGitCommit()

  external.reportGitHubStatus("media-deps-check", commit, "pending", "Waiting for an executor")

  stage('Validate') {
    build_helpers.buildMediaDepsCheck('linux.clang11')
  }
} else {
  try {
    build_helpers.buildValidBranchCheck('linux.clang11')
    def fullVersion = build_helpers.getFullVersion(baseVersionFile)
    external.notifyBuild('STARTED')
    def props = []
    props << buildDiscarder(logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '35'))
    properties(props)

    // Find out the current git commit and notify GitHub
    def commit = helpers.getGitCommit()
    external.reportGitHubStatus("linux", commit, "pending", "Waiting for an executor")

    stage('Build') {
      linuxReleaseBuildTime = timers.codeTimer({ buildOnNode('linux.clang11', 'linux') }, 60000)
      buildTimes.put('linux-release', linuxReleaseBuildTime)
    }

    if (branch.isFeatureBranch()) {
      deployUrl = build_helpers.getNonProdDeployPromotionUrl('shasta', baseVersionFile)
    }

    if (branch.isDevelopBranch()) {
      deployUrl = build_helpers.getProdDeployPromotionUrl('shasta', baseVersionFile)
    }
  // See https://issues.jenkins-ci.org/browse/JENKINS-28822 and
  // https://issues.jenkins-ci.org/browse/JENKINS-34376
  } catch (org.jenkinsci.plugins.workflow.steps.FlowInterruptedException e) {
    // User probably aborted
    if (e.causes.size() == 0) {
      echo "Build aborted (FlowInterruptedException)"
      currentBuild.result = "ABORTED"
    } else {
      echo "Build failed (FlowInterruptedException)"
      currentBuild.result = "FAILURE"
    }
    echo e.getMessage()
  } catch (hudson.AbortException e) {
    // User probably aborted during shell step
    if (e.getMessage().contains('script returned exit code 143')) {
      echo "Build aborted (AbortException)"
      currentBuild.result = "ABORTED"
    } else {
      echo "Build failed (AbortException)"
      currentBuild.result = "FAILURE"
    }
    echo e.getMessage()
  } catch (e) {
    // If there was an exception thrown, the build failed
    echo "Build failed"
    echo e.getMessage()
    currentBuild.result = "FAILURE"
  } finally {
    echo "Notifying result"
    // build status of null means successful
    currentBuild.result = currentBuild.result ?: 'SUCCESS'
  }

  // set build description for successful release builds.
  if (currentBuild.result == 'SUCCESS' && deployUrl != null) {
    currentBuild.description = "<a href=\"${deployUrl}\">Deploy ${build_helpers.getFullVersion(baseVersionFile)}</a><br>${build_helpers.getFullVersion(baseVersionFile)}"
  }

  external.notifyBuild(currentBuild.result)
  external.mailer()

  helpers.graphBuildTimes(buildTimes, "minutes")
}
