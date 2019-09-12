#!/bin/bash
set -e

: ${SETUP_DIR=$(pwd)/setup_db}
: ${TRANSCRIPTS=20}

../setup-tools/build/verify 100800000 1 5040000 0 $SETUP_DIR/transcript0.dat
for TRANSCRIPT in $(seq 1 $[TRANSCRIPTS - 1]); do
  ../setup-tools/build/verify 100800000 1 5040000 $TRANSCRIPT $SETUP_DIR/transcript${TRANSCRIPT}.dat $SETUP_DIR/transcript0.dat $SETUP_DIR/transcript$[TRANSCRIPT -1].dat
done