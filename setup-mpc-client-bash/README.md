# setup-mpc-client-bash

This project contains a few bash scripts which can be used as a reference as to how to interact with the coordination server.

## Requirements

- You need to be running [setup-mpc-client](../setup-mpc-client) with the environment variable `COMPUTE_OFFLINE=1`.
- You need to be running an ETH node such as ganache configured with the account that you will use to verify with the server.

## Usage

There are a few environment variables that must/can be specified to perform the computation.

- `ADDRESS`: (required) The address to use to sign the transcripts for upload to the server.
- `PREV_ADDRESS`: (required) The address of the previous participant to build upon.
- `ETH_URL`: (default: http://localhost:8545) The URL of ganache configured with the signing account.
- `API_URL`: (default: https://ignition.aztecprotocol.com) The URL of the coordination server.
- `TRANSCRIPTS`: (default: 20) The number of transcripts files.
- `SETUP_DIR`: (default: ./setup_db) The working directory for the transcript files.

Example:

```
PREV_ADDRESS=0x6Bd7Ea43FB9E05F551ad4128dD8E412B15B6a770 ADDRESS=0xD528f97aeB2297007f9348B295ee2D475918D517 ./compute.sh
```

This will download 20 transcript files from the previous participant, perform the computation, sign the files and upload them.

## I'm air-gapped / Using my own implementation

Then you will have generated your own sequence of transcript files. You can use the `./upload.sh` script to upload them.
The files will have to be named in the format `transcript0_out.dat`, `transcript1_out.dat`, etc, and be located in `SETUP_DIR`.

Example:

```
ADDRESS=0xD528f97aeB2297007f9348B295ee2D475918D517 ./upload.sh
```
