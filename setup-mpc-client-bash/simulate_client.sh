#!/bin/bash
set -e
set -x

: ${API_URL=https://ignition.aztecprotocol.com}
: ${ETH_URL=http://localhost:8545}
: ${SETUP_DIR=$(pwd)/setup_db}
: ${TRANSCRIPTS=20}

function sendMessage() {
  SIGNATURE=$(curl -s -S -X POST --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_sign\",\"params\":[\"$ADDRESS\", \"$(echo -n "$1" | xxd -pu -c1000)\"],\"id\":1}" $ETH_URL | jq -j .result)
  if [ -z "$3" ]; then
    curl -s -S $API_URL/api$2 -H "X-Signature: $SIGNATURE"
  else
    curl -s -S $API_URL/api$2 -H "X-Signature: $SIGNATURE" -H "Content-Type: application/json" -X PATCH -d "$1"
  fi
}

sendMessage "ping" "/ping/$ADDRESS"
sleep 1
while true; do
  sendMessage "{\"runningState\":\"OFFLINE\",\"computeProgress\":0}" "/participant/$ADDRESS" 1
  sleep 5
done