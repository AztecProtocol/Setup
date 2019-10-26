#!/bin/bash
set -e
git submodule init && git submodule update
cd ./setup-tools
./build.sh
cd ../setup-mpc-common
docker build -t 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-common:latest .
cd ../setup-mpc-client
docker build -t aztecprotocol/setup-mpc-client:latest .