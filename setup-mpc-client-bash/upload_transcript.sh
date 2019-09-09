#!/bin/bash
set -e

: ${ETH_URL=http://localhost:8545}
: ${API_URL=https://ignition.aztecprotocol.com}
: ${SETUP_DIR=$(pwd)/setup_db}
: ${TRANSCRIPT=0}

echo Uploading transcript $ADDRESS/$TRANSCRIPT...
SIGNATURE=$(curl -s -S -X POST --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_sign\",\"params\":[\"$ADDRESS\", \"$(shasum -a 256 $SETUP_DIR/transcript${TRANSCRIPT}_out.dat)\"],\"id\":1}" $ETH_URL | jq -j .result)
curl -s -S $API_URL/api/data/$ADDRESS/$TRANSCRIPT --upload-file $SETUP_DIR/transcript${TRANSCRIPT}_out.dat -H "X-Signature: $SIGNATURE" > /dev/null