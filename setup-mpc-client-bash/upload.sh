#!/bin/bash
set -e

: ${TRANSCRIPTS=20}

for TRANSCRIPT in $(seq 0 $[TRANSCRIPTS - 1]); do
  TRANSCRIPT=$TRANSCRIPT ./upload_transcript.sh
done