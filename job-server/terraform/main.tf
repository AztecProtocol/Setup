terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/job-server"
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

# We use redis as a backing store for the job-server.
resource "aws_elasticache_subnet_group" "setup_redis" {
  name       = "setup-redis-subnet"
  subnet_ids = ["${data.terraform_remote_state.setup_iac.outputs.subnet_az1_private_id}"]
}

resource "aws_elasticache_cluster" "setup_redis" {
  cluster_id           = "setup-redis"
  engine               = "redis"
  node_type            = "cache.t2.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis3.2"
  engine_version       = "3.2.10"
  port                 = 6379
  subnet_group_name    = "${aws_elasticache_subnet_group.setup_redis.name}"
  security_group_ids   = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
}

# Service discovery.
resource "aws_service_discovery_service" "job_server" {
  name = "job-server"

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

# Need a load balancer for our service endpoint for access via VPC peering.
resource "aws_lb" "lb" {
  name               = "setup-job-server"
  internal           = true
  load_balancer_type = "application"
  security_groups    = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
  subnets = [
    "${data.terraform_remote_state.setup_iac.outputs.subnet_az1_private_id}",
    "${data.terraform_remote_state.setup_iac.outputs.subnet_az2_private_id}"
  ]

  tags = {
    name = "setup-job-server"
  }
}

resource "aws_lb_target_group" "job_server" {
  name                 = "setup-job-server"
  port                 = "80"
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = "${data.terraform_remote_state.setup_iac.outputs.vpc_id}"
  deregistration_delay = 5

  health_check {
    path              = "/"
    matcher           = "200"
    interval          = 5
    healthy_threshold = 2
    timeout           = 3
  }

  tags = {
    name = "setup-job-server"
  }
}

resource "aws_alb_listener" "listener" {
  load_balancer_arn = "${aws_lb.lb.arn}"
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = "${aws_lb_target_group.job_server.arn}"
  }
}

# Create our job-server service.
resource "aws_ecs_task_definition" "setup_job_server" {
  family                   = "setup-job-server"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${data.terraform_remote_state.setup_iac.outputs.ecs_task_execution_role_arn}"

  container_definitions = <<DEFINITIONS
[
  {
    "name": "setup-job-server",
    "image": "278380418400.dkr.ecr.eu-west-2.amazonaws.com/job-server:latest",
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
        "name": "REDIS_URL",
        "value": "redis://${aws_elasticache_cluster.setup_redis.cache_nodes.0.address}"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/fargate/service/setup-job-server",
        "awslogs-region": "eu-west-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }
]
DEFINITIONS
}

data "aws_ecs_task_definition" "setup_job_server" {
  task_definition = "${aws_ecs_task_definition.setup_job_server.family}"
}

resource "aws_ecs_service" "setup_job_server" {
  name          = "setup-job-server"
  cluster       = "${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_id}"
  launch_type   = "FARGATE"
  desired_count = "1"

  network_configuration {
    subnets = [
      "${data.terraform_remote_state.setup_iac.outputs.subnet_az1_private_id}",
      "${data.terraform_remote_state.setup_iac.outputs.subnet_az2_private_id}"
    ]

    security_groups = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
  }

  service_registries {
    registry_arn = "${aws_service_discovery_service.job_server.arn}"
  }

  load_balancer {
    target_group_arn = "${aws_lb_target_group.job_server.arn}"
    container_name   = "setup-job-server"
    container_port   = 80
  }

  # Track the latest ACTIVE revision
  task_definition = "${aws_ecs_task_definition.setup_job_server.family}:${max("${aws_ecs_task_definition.setup_job_server.revision}", "${data.aws_ecs_task_definition.setup_job_server.revision}")}"
}

# Logging job-server to CloudWatch
resource "aws_cloudwatch_log_group" "setup_job_server_logs" {
  name              = "/fargate/service/setup-job-server"
  retention_in_days = "14"
}
