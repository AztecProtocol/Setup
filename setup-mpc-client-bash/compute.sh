#!/bin/bash
set -e

: ${ETH_URL=http://localhost:8545}
: ${API_URL=https://ignition.aztecprotocol.com}
: ${TRANSCRIPTS=20}
: ${SETUP_DIR=$(pwd)/setup_db}

if [ -z "$PREV_ADDRESS" -o -z "$ADDRESS" ]; then
  echo usage: ADDRESS=0x... PREV_ADDRESS=0x... $0
  exit 1
fi

./download.sh
../setup-tools/build/setup $SETUP_DIR
./upload.sh