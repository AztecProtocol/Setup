#!/bin/bash
set -e
aws ecr describe-repositories --repository-names setup-mpc-map > /dev/null 2>&1 || aws ecr create-repository --repository-name setup-mpc-map
docker push 278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-map

# Apply terraform.
cd terraform
terraform init -input=false
terraform apply -input=false -auto-approve

# Restart with latest image.
aws ecs update-service --cluster setup --service setup-mpc-map --force-new-deployment