#!/bin/bash
set -e

: ${ETH_URL=http://localhost:8545}
: ${SETUP_DIR=$(pwd)/setup_db}
: ${TRANSCRIPTS=20}

for TRANSCRIPT in $(seq 0 $[TRANSCRIPTS - 1]); do
  echo Signing transcript $ADDRESS/$TRANSCRIPT...
  curl -s -S -X POST --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_sign\",\"params\":[\"$ADDRESS\", \"$(shasum -a 256 $SETUP_DIR/transcript${TRANSCRIPT}_out.dat)\"],\"id\":1}" $ETH_URL | jq -j .result > $SETUP_DIR/transcript${TRANSCRIPT}_out.sig
done