#!/bin/bash
set -e

: ${API_URL=https://ignition.aztecprotocol.com}
: ${SETUP_DIR=$(pwd)/setup_db}
: ${SIGS=$SETUP_DIR/sigs.json}
: ${TRANSCRIPTS=20}

for TRANSCRIPT in $(seq 0 $[TRANSCRIPTS - 1]); do
  SIGNATURE=$(cat $SIGS | jq -r ".[$TRANSCRIPT]")
  echo "Uploading transcript $TRANSCRIPT with signature $SIGNATURE..."
  curl -s -S $API_URL/api/data/$ADDRESS/$TRANSCRIPT --upload-file $SETUP_DIR/transcript${TRANSCRIPT}${TRANSCRIPT_POSTFIX}.dat -H "X-Signature: $SIGNATURE" > /dev/null
done