# AZTEC Ignition Monorepo

This repository contains all code relating to the AZTEC trusted setup multi-party computation.
An overview of the different projects, in order of relevance and interest:

- [setup-tools](/setup-tools) - C++ codebase of the actual computation code, verification code etc.
- [setup-mpc-server](/setup-mpc-server) - Coordination server for participants partaking in the MPC.
- [setup-mpc-client](/setup-mpc-client) - Client terminal application for execution of client side tools and reporting to server.
- [setup-mpc-client-bash](/setup-mpc-client-bash) - Helpful reference bash scripts for running the trusted setup without the client application above.
- [setup-mpc-common](/setup-mpc-common) - Shared code between server and client applications.
- [setup-mpc-map](/setup-mpc-map) - The globe visualisation webapp.
- [job-server](/job-server) - Coordination server for the post-processing phase.
- [setup-post-process](/setup-post-process) - Task application for post-processing phase.
- [setup-iac](/setup-iac) - Global Terraform for the ignition application infrastructure.
- [ci-scripts](/ci-scripts) - Build scripts.

## Participating

Brief technical overview of particpating in the MPC. Further information available [here](https://app.gitbook.com/@aztec-protocol/s/mpc).

#### The Easy Way

The simplest way to participate is to run [setup-mpc-client](/setup-mpc-client). The only input required to the application is the private key of the address used to register.
The application will then display the current ceremony status, and will automatically handle your computation when your turn comes around.

For participants that did not sign up with AZTEC personally (i.e. you registered by sending 1 wei to the registration address). This is the only recommended option.
While it's possible to perform the computation the hard way, additional time constraints are applied that institutional participants are not subject to, and you will need
to ensure you are meeting the targeted verification rate throughout the process.

#### The Hard Way

If you want to get ambitious, you may wish to run the computation on, for example, an air-gapped laptop within a faraday cage in the middle of a desert.
Further, you may wish to run either your own implementation, or build the `setup-tools` binaries and run those.

Either way, it's still necessary to signal to the server that you are online, in order to be allocated your position in the queue. This can be acheived by running `setup-mpc-client` in a special offline mode,
or you can use something like the `simulate_client.sh` script in `setup-mpc-client-bash` to acheive the same without running the container, sacrificing visualisation of the ceremony.

The instructions in [setup-tools](/setup-tools) should guide you on how to build and run the binaries.

#### The Procedure

During the ceremony it is not necessary to validate the previous participants, nor the server, have acted honestly. As a participant what's important is for you to validate that your randomness has been included in the final set of published transcripts. As a non-participant, what's important is to verify that every participant that claimed to have included randomness, did so.

##### Computation

1. Signal to the server you are online, and wait until your position in queue shifts to the `RUNNING` state. You can monitor the ceremony [here](https://ignition.aztecprotocol.com), or by calling the server directly as per the server API documentation.
1. Download the previous participants transcripts.
1. Transfer the previous participants transcripts to your safe environment.
1. Run either the provided `setup` binary in your safe environment, or your own implementation. If writing your own implementation you can follow the transcript specification [here](https://gist.github.com/zac-williamson/bc0774e2bd4cad6ffd5e2edd2166a30c).
1. Generate signatures of the SHA256 digest of each transcript signed with your private key.
1. Transfer the output transcripts and signatures back to your online environment.
1. Upload the transcripts and signatures to the server (see `upload.sh` as a reference).

##### Verification

1. Download the full set of transcripts and signatures for all participants.
1. Verify that SHA256 digests of the transcripts were signed by the expected participants.
1. Verify that the first transcript of each participant was built on top of the previous participants first transcript.
1. Verify that each subsequent transcript follows from the transcript before.

## Building The Entire Repository

After cloning the repo:

`git submodule init && git submodule update`

In order to efficiently manage the monorepo we are using `mbt`. It's not necessary to install `mbt` to build each project but it may simplify things.
Binaries are available below, install in your `PATH` as `mbt`:

- [OS X](https://dl.bintray.com/buddyspike/bin/mbt_darwin_x86_64/0.23.0/0.23.0/:mbt_darwin_x86_64)
- [Linux](https://dl.bintray.com/buddyspike/bin/mbt_linux_x86_64/0.23.0/0.23.0/:mbt_linux_x86_64)
- [Windows](https://dl.bintray.com/buddyspike/bin/0.23.0/:mbt_windows_x86.zip)

Once installed:

`mbt build local`
