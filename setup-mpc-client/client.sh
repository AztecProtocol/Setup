#!/bin/bash
docker-compose run -e PRIVATE_KEY=$1 --use-aliases --service-ports setup-mpc-client
