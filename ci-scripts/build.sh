#!/bin/bash
set -e

IMAGE_NAME=$1

# Docker layer caching can have old layers. Pull given images from remote if we haven't rebuilt this run.
for DEP in $2; do
  if [ ! -f /tmp/${DEP#*/}.rebuilt ]; then
    docker pull $DEP:latest
  fi
done

docker build -t $IMAGE_NAME:latest .
if [ -n "$CIRCLE_SHA1" ]; then
  docker tag $IMAGE_NAME:latest $IMAGE_NAME:$CIRCLE_SHA1
fi

touch /tmp/${IMAGE_NAME#*/}.rebuilt