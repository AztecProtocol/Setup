#!/bin/bash
set -e

docker push aztecprotocol/$1:latest
if [ -n "$CIRCLE_SHA1" ]; then
  docker push aztecprotocol/$1:$CIRCLE_SHA1
fi