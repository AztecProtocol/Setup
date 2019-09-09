#!/bin/bash
if [ -n "$2" ]; then
  docker-compose run -e EXIT_ON_COMPLETE=$3 -e API_URL=https://setup-staging.aztecprotocol.com/api -e PRIVATE_KEY=$1 --use-aliases --service-ports setup-mpc-client
else
  docker-compose run -e EXIT_ON_COMPLETE=$3 -e PRIVATE_KEY=$1 --use-aliases --service-ports setup-mpc-client
fi
