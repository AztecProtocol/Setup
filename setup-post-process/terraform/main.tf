terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-post-processing"
    region = "eu-west-2"
  }
}

data "terraform_remote_state" "setup_iac" {
  backend = "s3"
  config = {
    bucket = "aztec-terraform"
    key    = "setup/setup-iac"
    region = "eu-west-2"
  }
}

data "terraform_remote_state" "setup_iac_us_east_2" {
  backend = "s3"
  config = {
    bucket = "aztec-terraform"
    key    = "setup/setup-iac/us-east-2"
    region = "eu-west-2"
  }
}

provider "aws" {
  profile = "default"
  region  = "us-east-2"
}

# Create spot fleet.
resource "aws_spot_fleet_request" "main" {
  iam_fleet_role                      = "${data.terraform_remote_state.setup_iac.outputs.ecs_spot_fleet_role_arn}"
  allocation_strategy                 = "diversified"
  target_capacity                     = "32"
  spot_price                          = "0.013"
  terminate_instances_with_expiration = true
  valid_until                         = "2020-01-01T00:00:00Z"

  launch_specification {
    weighted_capacity      = 16
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "m5.4xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 16
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "m5.4xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  lifecycle {
    ignore_changes = ["valid_until"]
  }
}

resource "aws_ecs_task_definition" "setup_post_process" {
  family                   = "setup-post-process"
  requires_compatibilities = ["EC2"]
  network_mode             = "awsvpc"
  execution_role_arn       = "${data.terraform_remote_state.setup_iac.outputs.ecs_task_execution_role_arn}"

  container_definitions = <<DEFINITIONS
[
  {
    "name": "setup-post-process",
    "image": "278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-post-process:latest",
    "essential": true,
    "memoryReservation": 256,
    "environment": [
      {
        "name": "JOB_SERVER_HOST",
        "value": "internal-setup-job-server-466812739.eu-west-2.elb.amazonaws.com"
      },
      {
        "name": "MPC_SERVER_HOST",
        "value": "ignition.aztecprotocol.com"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/service/setup-post-process",
        "awslogs-region": "us-east-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }
]
DEFINITIONS
}

data "aws_ecs_task_definition" "setup_post_process" {
  task_definition = "${aws_ecs_task_definition.setup_post_process.family}"
}

resource "aws_ecs_service" "setup_post_process" {
  name                               = "setup-post-process"
  cluster                            = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_id}"
  launch_type                        = "EC2"
  desired_count                      = "2"
  deployment_maximum_percent         = 100
  deployment_minimum_healthy_percent = 0

  network_configuration {
    subnets = [
      "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}",
      "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    ]
    security_groups = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
  }

  placement_constraints {
    type = "distinctInstance"
  }

  placement_constraints {
    type       = "memberOf"
    expression = "attribute:group == setup-post-process"
  }

  # Track the latest ACTIVE revision
  # task_definition = "${aws_ecs_task_definition.setup_post_process.family}"
  task_definition = "${aws_ecs_task_definition.setup_post_process.family}:${max("${aws_ecs_task_definition.setup_post_process.revision}", "${data.aws_ecs_task_definition.setup_post_process.revision}")}"
}

# Logging setup-post-process to CloudWatch
resource "aws_cloudwatch_log_group" "setup_post_process" {
  name              = "/service/setup-post-process"
  retention_in_days = "14"
}
