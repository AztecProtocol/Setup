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

provider "aws" {
  profile = "default"
  region  = "eu-west-2"
}

data "aws_iam_policy_document" "fleet_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["spotfleet.amazonaws.com", "ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2_spot_fleet_role" {
  name               = "ec2-spot-fleet-role"
  assume_role_policy = "${data.aws_iam_policy_document.fleet_assume_role_policy.json}"
}

resource "aws_iam_role_policy_attachment" "ec2_spot_fleet_policy" {
  role       = "${aws_iam_role.ec2_spot_fleet_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetRole"
}

/*
resource "aws_spot_fleet_request" "main" {
  iam_fleet_role                      = "${aws_iam_role.ec2_spot_fleet_role.arn}"
  allocation_strategy                 = "diversified"
  target_capacity                     = "32"
  spot_price                          = "0.017"
  terminate_instances_with_expiration = true
  valid_until                         = "2020-01-01T00:00:00Z"

  launch_specification {
    weighted_capacity      = 16
    ami                    = "ami-08ebd554ebc53fa9f"
    instance_type          = "m5.4xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_key_pair_name}"
    availability_zone      = "eu-west-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-az1"
    }
  }

  launch_specification {
    weighted_capacity      = 16
    ami                    = "ami-08ebd554ebc53fa9f"
    instance_type          = "m5.4xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_key_pair_name}"
    availability_zone      = "eu-west-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-az2"
    }
  }

  lifecycle {
    ignore_changes = ["valid_until"]
  }
}
*/

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
        "value": "job-server.local"
      },
      {
        "name": "MPC_SERVER_HOST",
        "value": "setup-mpc-server.local"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/fargate/service/setup-post-process",
        "awslogs-region": "eu-west-2",
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
  cluster                            = "${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_id}"
  launch_type                        = "EC2"
  desired_count                      = "2"
  deployment_maximum_percent         = 100
  deployment_minimum_healthy_percent = 0

  network_configuration {
    subnets = [
      "${data.terraform_remote_state.setup_iac.outputs.subnet_az1_private_id}",
      "${data.terraform_remote_state.setup_iac.outputs.subnet_az2_private_id}"
    ]
    security_groups = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
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
  name              = "/fargate/service/setup-post-process"
  retention_in_days = "14"
}
