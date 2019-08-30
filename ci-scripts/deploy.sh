#!/bin/bash
set -e

LIFECYCLE_POLICY='{
  "rules": [
    {
      "rulePriority": 1,
      "description": "No more than 10 images.",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
'

aws ecr describe-repositories --repository-names $1 > /dev/null 2>&1 || \
  (aws ecr create-repository --repository-name $1 && \
   aws ecr put-lifecycle-policy --repository-name $1 --lifecycle-policy-text "$LIFECYCLE_POLICY")
docker push 278380418400.dkr.ecr.eu-west-2.amazonaws.com/$1:latest
if [ -n "$CIRCLE_SHA1" ]; then
  docker push 278380418400.dkr.ecr.eu-west-2.amazonaws.com/$1:$CIRCLE_SHA1
fi

# Apply terraform.
if [ -d ./terraform ]; then
  cd terraform
  terraform init -input=false
  terraform apply -input=false -auto-approve
fi

# Restart with latest image.
if aws ecs list-services --cluster setup | grep $1 > /dev/null; then
  aws ecs update-service --cluster setup --service $1 --force-new-deployment
fi