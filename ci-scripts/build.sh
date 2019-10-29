#!/bin/bash
set -e

IMAGE_NAME=$1

# Docker layer caching can have old layers. Always pull given images from remote.
for DEP in $2; do
  docker pull $DEP
done

docker build -t $IMAGE_NAME:latest .
if [ -n "$CIRCLE_SHA1" ]; then
  docker tag $IMAGE_NAME:latest $IMAGE_NAME:$CIRCLE_SHA1
fi