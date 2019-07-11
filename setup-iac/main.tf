terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-iac"
    region = "eu-west-2"
  }
}

provider "aws" {
  shared_credentials_file = "$HOME/.aws/credentials"
  profile                 = "default"
  region                  = "eu-west-2"
}

# We create a private network just for handling setup.
resource "aws_vpc" "setup" {
  cidr_block = "10.0.0.0/16"

  tags {
    Name = "setup"
  }
}

resource "aws_subnet" "setup" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.0.0.0/24"
  availability_zone = "eu-west-2a"

  tags {
    Name = "setup"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = "${aws_vpc.setup.id}"

  tags {
    Name = "setup"
  }
}

resource "aws_route" "internet_access" {
  route_table_id         = "${aws_vpc.setup.main_route_table_id}"
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = "${aws_internet_gateway.gw.id}"
}

resource "aws_security_group" "setup" {
  name   = "setup"
  vpc_id = "${aws_vpc.setup.id}"

  ingress {
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }

  tags {
    Name = "setup"
  }
}

# We use redis as a backing store for the job-server. Allocated within 10.0.0.* subnet.
resource "aws_elasticache_subnet_group" "setup_redis" {
  name       = "setup-redis-subnet"
  subnet_ids = ["${aws_subnet.setup.id}"]
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
  security_group_ids   = ["${aws_security_group.setup.id}"]
}

# We require a task execution role for the ECS container agent to make calls to the ECS API.
# https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html
data "aws_iam_policy_document" "assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name               = "ecs-task-execution-role"
  assume_role_policy = "${data.aws_iam_policy_document.assume_role_policy.json}"
}

resource "aws_iam_role_policy_attachment" "ecs-task-execution-policy" {
  role       = "${aws_iam_role.ecs_task_execution_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Create our cluster on Fargate to run the job server.
resource "aws_ecs_cluster" "setup" {
  # TODO: Rename to setup
  name = "setup-job-server"
}

resource "aws_ecs_task_definition" "setup_job_server" {
  family                   = "setup-job-server"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "${aws_iam_role.ecs_task_execution_role.arn}"

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

resource "aws_ecs_service" "setup_job_server" {
  name            = "setup-job-server"
  cluster         = "${aws_ecs_cluster.setup.id}"
  launch_type     = "FARGATE"
  task_definition = "${aws_ecs_task_definition.setup_job_server.arn}"
  desired_count   = "1"

  network_configuration {
    subnets = ["${aws_subnet.setup.id}"]

    security_groups  = ["${aws_security_group.setup.id}"]
    assign_public_ip = true
  }

  /*
  load_balancer {
    target_group_arn = "${aws_alb_target_group.main.id}"
    container_name   = "${var.container_name}"
    container_port   = "${var.container_port}"
  }

  # workaround for https://github.com/hashicorp/terraform/issues/12634
  depends_on = [
    "aws_alb_listener.http",
  ]
  */

  # [after initial apply] don't override changes made to task_definition
  # from outside of terraform (i.e. fargate cli)
  lifecycle {
    ignore_changes = ["task_definition"]
  }
}

# Logging job-server to CloudWatch
resource "aws_cloudwatch_log_group" "setup_job_server_logs" {
  name              = "/fargate/service/setup-job-server"
  retention_in_days = "14"
}
