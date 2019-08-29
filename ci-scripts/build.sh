#!/bin/bash
set -e

IMAGE_NAME=$1
REGISTRY=${2:-278380418400.dkr.ecr.eu-west-2.amazonaws.com}

docker build -t $REGISTRY/$IMAGE_NAME:latest .
if [ -n "$CIRCLE_SHA1" ]; then
  docker tag $REGISTRY/$IMAGE_NAME:latest $REGISTRY/$IMAGE_NAME:$CIRCLE_SHA1
fi