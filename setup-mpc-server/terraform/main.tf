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
  name          = "setup-mpc-server"
  cluster       = "${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_id}"
  launch_type   = "FARGATE"
  desired_count = "1"

  network_configuration {
    subnets         = ["${data.terraform_remote_state.setup_iac.outputs.subnet_az1_id}"]
    security_groups = ["${data.terraform_remote_state.setup_iac.outputs.security_group_public_id}"]
  }

  load_balancer {
    target_group_arn = "${aws_alb_target_group.setup_mpc_server.arn}"
    container_name   = "setup-mpc-server"
    container_port   = 80
  }

  service_registries {
    registry_arn = "${aws_service_discovery_service.setup_mpc_server.arn}"
  }

  task_definition = "${aws_ecs_task_definition.setup_mpc_server.family}:${max("${aws_ecs_task_definition.setup_mpc_server.revision}", "${data.aws_ecs_task_definition.setup_mpc_server.revision}")}"

  lifecycle {
    ignore_changes = ["task_definition"]
  }
}

resource "aws_cloudwatch_log_group" "setup_mpc_server_logs" {
  name              = "/fargate/service/setup-mpc-server"
  retention_in_days = "14"
}

resource "aws_alb_target_group" "setup_mpc_server" {
  name        = "setup-mpc-server"
  port        = "80"
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = "${data.terraform_remote_state.setup_iac.outputs.vpc_id}"

  health_check {
    path    = "/api"
    matcher = "200"
  }

  tags = {
    name = "setup-mpc-server"
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = "${data.terraform_remote_state.setup_iac.outputs.alb_listener_arn}"
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = "${aws_alb_target_group.setup_mpc_server.arn}"
  }

  condition {
    field  = "path-pattern"
    values = ["/api/*"]
  }
}
