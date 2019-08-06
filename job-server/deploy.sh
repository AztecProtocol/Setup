#!/bin/bash
set -e
aws ecr describe-repositories --repository-names job-server > /dev/null 2>&1 || aws ecr create-repository --repository-name job-server
docker push 278380418400.dkr.ecr.eu-west-2.amazonaws.com/job-server