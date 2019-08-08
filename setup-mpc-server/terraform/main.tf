terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-mpc-server"
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

resource "aws_service_discovery_service" "setup_mpc_server" {
  name = "setup-mpc-server"

  health_check_custom_config {
    failure_threshold = 1
  }

  dns_config {
    namespace_id = "${data.terraform_remote_state.setup_iac.outputs.local_service_discovery_id}"

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }
}

resource "aws_ecs_task_definition" "setup_mpc_server" {
  family                   = "setup-mpc-server"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${data.terraform_remote_state.setup_iac.outputs.ecs_task_execution_role_arn}"

  container_definitions = <<DEFINITIONS
[
  {
    "name": "setup-mpc-server",
    "image": "278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-server:latest",
    "essential": true,
    "portMappings": [
      {
        "containerPort": 80
      }
    ],
    "environment": [
      {
        "name": "NODE_ENV",
        "value": "production"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/fargate/service/setup-mpc-server",
        "awslogs-region": "eu-west-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }
]
DEFINITIONS
}

data "aws_ecs_task_definition" "setup_mpc_server" {
  task_definition = "${aws_ecs_task_definition.setup_mpc_server.family}"
}

resource "aws_ecs_service" "setup_mpc_server" {
  name = "setup-mpc-server"
  cluster = "${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_setup_id}"
  launch_type = "FARGATE"
  desired_count = "1"

  network_configuration {
    subnets = ["${data.terraform_remote_state.setup_iac.outputs.subnet_setup_id}"]

    security_groups = ["${data.terraform_remote_state.setup_iac.outputs.security_group_setup_public_id}"]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = "${aws_service_discovery_service.setup_mpc_server.arn}"
  }

  # Track the latest ACTIVE revision
  task_definition = "${aws_ecs_task_definition.setup_mpc_server.family}:${max("${aws_ecs_task_definition.setup_mpc_server.revision}", "${data.aws_ecs_task_definition.setup_mpc_server.revision}")}"
}

resource "aws_cloudwatch_log_group" "setup_mpc_server_logs" {
  name = "/fargate/service/setup-mpc-server"
  retention_in_days = "14"
}
