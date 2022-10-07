terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-mpc-alerts"
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

variable "SLACK_MPC_TOKEN" {
  type = "string"
}

resource "aws_ecs_task_definition" "setup_mpc_alerts" {
  family                   = "setup-mpc-alerts"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${data.terraform_remote_state.setup_iac.outputs.ecs_task_execution_role_arn}"

  container_definitions = <<DEFINITIONS
[
  {
    "name": "setup-mpc-alerts",
    "image": "278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-alerts:latest",
    "essential": true,
    "environment": [
      {
        "name": "NODE_ENV",
        "value": "production"
      },
      {
        "name": "SLACK_MPC_TOKEN",
        "value": "${var.SLACK_MPC_TOKEN}"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/fargate/service/setup-mpc-alerts",
        "awslogs-region": "eu-west-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }
]
DEFINITIONS
}

data "aws_ecs_task_definition" "setup_mpc_alerts" {
  task_definition = "${aws_ecs_task_definition.setup_mpc_alerts.family}"
}

resource "aws_ecs_service" "setup_mpc_alerts" {
  name          = "setup-mpc-alerts"
  cluster       = "${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_id}"
  launch_type   = "FARGATE"
  desired_count = "0"

  network_configuration {
    subnets = [
      "${data.terraform_remote_state.setup_iac.outputs.subnet_az1_private_id}",
      "${data.terraform_remote_state.setup_iac.outputs.subnet_az2_private_id}"
    ]
    security_groups = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
  }

  # Track the latest ACTIVE revision
  task_definition = "${aws_ecs_task_definition.setup_mpc_alerts.family}:${max("${aws_ecs_task_definition.setup_mpc_alerts.revision}", "${data.aws_ecs_task_definition.setup_mpc_alerts.revision}")}"

  lifecycle {
    ignore_changes = ["task_definition"]
  }
}

resource "aws_cloudwatch_log_group" "setup_mpc_alerts_logs" {
  name              = "/fargate/service/setup-mpc-alerts"
  retention_in_days = "14"
}
