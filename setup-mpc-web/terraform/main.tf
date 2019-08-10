terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-mpc-web"
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

resource "aws_service_discovery_service" "setup_mpc_web" {
  name = "setup-mpc-web"

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

resource "aws_ecs_task_definition" "setup_mpc_web" {
  family                   = "setup-mpc-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${data.terraform_remote_state.setup_iac.outputs.ecs_task_execution_role_arn}"

  container_definitions = <<DEFINITIONS
[
  {
    "name": "setup-mpc-web",
    "image": "278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-mpc-web:latest",
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
      },
      {
        "name": "PORT",
        "value": "80"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/fargate/service/setup-mpc-web",
        "awslogs-region": "eu-west-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }
]
DEFINITIONS
}

data "aws_ecs_task_definition" "setup_mpc_web" {
  task_definition = "${aws_ecs_task_definition.setup_mpc_web.family}"
}

resource "aws_ecs_service" "setup_mpc_web" {
  name          = "setup-mpc-web"
  cluster       = "${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_id}"
  launch_type   = "FARGATE"
  desired_count = "1"

  network_configuration {
    subnets         = ["${data.terraform_remote_state.setup_iac.outputs.subnet_az1_id}"]
    security_groups = ["${data.terraform_remote_state.setup_iac.outputs.security_group_public_id}"]
  }

  load_balancer {
    target_group_arn = "${aws_alb_target_group.setup_mpc_web.arn}"
    container_name   = "setup-mpc-web"
    container_port   = 80
  }

  service_registries {
    registry_arn = "${aws_service_discovery_service.setup_mpc_web.arn}"
  }

  # Track the latest ACTIVE revision
  task_definition = "${aws_ecs_task_definition.setup_mpc_web.family}:${max("${aws_ecs_task_definition.setup_mpc_web.revision}", "${data.aws_ecs_task_definition.setup_mpc_web.revision}")}"

  lifecycle {
    ignore_changes = ["task_definition"]
  }
}

resource "aws_cloudwatch_log_group" "setup_mpc_web_logs" {
  name              = "/fargate/service/setup-mpc-web"
  retention_in_days = "14"
}

resource "aws_alb_target_group" "setup_mpc_web" {
  name        = "setup-mpc-web"
  port        = "80"
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = "${data.terraform_remote_state.setup_iac.outputs.vpc_id}"
  tags = {
    name = "setup-mpc-web"
  }
}

resource "aws_lb_listener_rule" "setup_mpc_web" {
  listener_arn = "${data.terraform_remote_state.setup_iac.outputs.alb_listener_arn}"
  priority     = 1000

  action {
    type             = "forward"
    target_group_arn = "${aws_alb_target_group.setup_mpc_web.arn}"
  }

  condition {
    field  = "path-pattern"
    values = ["*"]
  }
}
