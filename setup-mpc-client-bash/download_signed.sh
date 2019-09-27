#!/bin/bash
set -e

: ${API_URL=https://ignition.aztecprotocol.com}
: ${TRANSCRIPTS=20}
: ${SETUP_DIR=$(pwd)/setup_db}

PREV_ADDRESS=$(echo $PREV_ADDRESS | tr '[:upper:]' '[:lower:]')

if [ ! -d "./recover-address/node_modules" ]; then
  pushd ./recover-address
  npm install
  popd
fi

mkdir -p $SETUP_DIR
rm -f $SETUP_DIR/*
for TRANSCRIPT in $(seq 0 $[TRANSCRIPTS - 1]); do
  echo Downloading transcript $PREV_ADDRESS/$TRANSCRIPT...
  FILENAME=$SETUP_DIR/transcript$TRANSCRIPT
  curl -s -S $API_URL/api/data/$PREV_ADDRESS/$TRANSCRIPT > $FILENAME.dat
  curl -s -S $API_URL/api/signature/$PREV_ADDRESS/$TRANSCRIPT > $FILENAME.sig
  RECOVERED=$(node recover-address 0x$(shasum -a 256 $FILENAME.dat | cut -f1 -d ' ') $(cat $FILENAME.sig))
  if [ "${RECOVERED}" != "${PREV_ADDRESS}" ]; then
    echo "Signature verification failed for transcript $TRANSCRIPT."
    exit 1
  fi
done