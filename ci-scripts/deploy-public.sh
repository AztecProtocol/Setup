#!/bin/bash
# Description: This script pushes a Docker image to the 'aztecprotocol' registry.
# It uses the first positional argument ($1) as the image name.
# It pushes with the 'latest' tag and, if a CIRCLE_SHA1 environment variable
# (typically from CircleCI) is present, it also pushes with the commit SHA as the tag.

# Exit immediately if any command fails. This is critical for CI/CD pipelines.
set -e

# The image name is passed as the first argument to the script
IMAGE_NAME="$1"

# 1. Push the image with the 'latest' tag
echo "Pushing aztecprotocol/${IMAGE_NAME}:latest..."
docker push aztecprotocol/"${IMAGE_NAME}":latest

# 2. If the CIRCLE_SHA1 environment variable is set (e.g., in a CI environment),
# push the image again using the commit SHA as the tag for permanent versioning.
if [ -n "$CIRCLE_SHA1" ]; then
  echo "CIRCLE_SHA1 found. Pushing aztecprotocol/${IMAGE_NAME}:${CIRCLE_SHA1}..."
  docker push aztecprotocol/"${IMAGE_NAME}":"${CIRCLE_SHA1}"
fi

echo "Docker push completed successfully."
