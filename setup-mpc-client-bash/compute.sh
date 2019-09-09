#!/bin/bash
set -e

: ${ETH_URL=http://localhost:8545}
: ${API_URL=https://ignition.aztecprotocol.com}
: ${TRANSCRIPTS=20}
: ${SETUP_DIR=$(pwd)/setup_db}

if [ -z "$ADDRESS" ]; then
  echo usage: ADDRESS=0x... [PREV_ADDRESS=0x...] $0
  exit 1
fi

mkdir -p $SETUP_DIR
rm -f $SETUP_DIR/*

if [ -n "$PREV_ADDRESS" ]; then
  ./download.sh
  ../setup-tools/build/setup $SETUP_DIR
else
  echo "create 1000000 1 50000" | ../setup-tools/build/setup $SETUP_DIR
fi

./upload.sh