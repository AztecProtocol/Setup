#!/bin/bash
docker build -f Dockerfile.build -t aztec/setup-tools-build .
docker build -f Dockerfile.deploy -t 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-tools .