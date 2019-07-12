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
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "setup"
  }
}

resource "aws_subnet" "setup" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.0.0.0/16"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "setup"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = "${aws_vpc.setup.id}"

  tags = {
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
    cidr_blocks = ["82.163.119.138/32", "217.169.11.246/32"]
  }

  ingress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }

  tags = {
    Name = "setup"
  }
}

# Private link endpoint interfaces to get access to AWS services.
resource "aws_vpc_endpoint" "ecs_agent" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecs-agent"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.setup.id}",
  ]

  subnet_ids = ["${aws_subnet.setup.id}"]
}

resource "aws_vpc_endpoint" "ecs_telemetry" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecs-telemetry"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.setup.id}",
  ]

  subnet_ids = ["${aws_subnet.setup.id}"]
}

resource "aws_vpc_endpoint" "ecs" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.setup.id}",
  ]

  subnet_ids = ["${aws_subnet.setup.id}"]
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.logs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.setup.id}",
  ]

  subnet_ids = ["${aws_subnet.setup.id}"]
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecr.api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.setup.id}",
  ]

  subnet_ids = ["${aws_subnet.setup.id}"]
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.setup.id}",
  ]

  subnet_ids = ["${aws_subnet.setup.id}"]
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = "${aws_vpc.setup.id}"
  service_name      = "com.amazonaws.eu-west-2.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = ["${aws_vpc.setup.main_route_table_id}"]
}

# Service discovery so the tasks can find the job-server.
resource "aws_service_discovery_private_dns_namespace" "local" {
  name        = "local"
  description = "local"
  vpc         = "${aws_vpc.setup.id}"
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

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = "${aws_iam_role.ecs_task_execution_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Create our cluster.
resource "aws_ecs_cluster" "setup" {
  name = "setup"
}

# Create our job-server service.
resource "aws_service_discovery_service" "job_server" {
  name = "job-server"

  health_check_custom_config {
    failure_threshold = 1
  }

  dns_config {
    namespace_id = "${aws_service_discovery_private_dns_namespace.local.id}"

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }
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

data "aws_ecs_task_definition" "setup_job_server" {
  task_definition = "${aws_ecs_task_definition.setup_job_server.family}"
}

resource "aws_ecs_service" "setup_job_server" {
  name = "setup-job-server"
  cluster = "${aws_ecs_cluster.setup.id}"
  launch_type = "FARGATE"
  desired_count = "1"

  network_configuration {
    subnets = ["${aws_subnet.setup.id}"]

    security_groups = ["${aws_security_group.setup.id}"]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = "${aws_service_discovery_service.job_server.arn}"
  }

  # Track the latest ACTIVE revision
  task_definition = "${aws_ecs_task_definition.setup_job_server.family}:${max("${aws_ecs_task_definition.setup_job_server.revision}", "${data.aws_ecs_task_definition.setup_job_server.revision}")}"
}

# Logging job-server to CloudWatch
resource "aws_cloudwatch_log_group" "setup_job_server_logs" {
  name = "/fargate/service/setup-job-server"
  retention_in_days = "14"
}

# Spot fleet for running tasks.
data "aws_iam_policy_document" "fleet_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = ["spotfleet.amazonaws.com", "ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2_spot_fleet_role" {
  name = "ec2-spot-fleet-role"
  assume_role_policy = "${data.aws_iam_policy_document.fleet_assume_role_policy.json}"
}

resource "aws_iam_role_policy_attachment" "ec2_spot_fleet_policy" {
  role = "${aws_iam_role.ec2_spot_fleet_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetRole"
}

data "aws_iam_policy_document" "instance_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "setup_ecs_instance" {
  name = "setup-ecs-instance"
  assume_role_policy = "${data.aws_iam_policy_document.instance_assume_role_policy.json}"
}

resource "aws_iam_instance_profile" "ecs" {
  name = "setup-ecs-instance"
  roles = ["${aws_iam_role.setup_ecs_instance.name}"]
}

resource "aws_iam_policy_attachment" "ecs_instance" {
  name = "setup-ecs-instance"
  roles = ["${aws_iam_role.setup_ecs_instance.name}"]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_spot_fleet_request" "main" {
  iam_fleet_role = "${aws_iam_role.ec2_spot_fleet_role.arn}"
  spot_price = "0.03"
  allocation_strategy = "diversified"
  target_capacity = "1"
  terminate_instances_with_expiration = false

  launch_specification {
    ami = "ami-013b322dbc79e9a6a"
    instance_type = "m5.xlarge"
    spot_price = "0.20"
    subnet_id = "${aws_subnet.setup.id}"
    vpc_security_group_ids = ["${aws_security_group.setup.id}"]
    iam_instance_profile = "${aws_iam_instance_profile.ecs.name}"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${aws_ecs_cluster.setup.name} >> /etc/ecs/ecs.config
USER_DATA
  }

  lifecycle {
    ignore_changes = ["valid_until"]
  }
}

resource "aws_ecs_task_definition" "setup_task" {
  family                   = "setup-task"
  requires_compatibilities = ["EC2"]
  memory                   = "15576"
  network_mode             = "awsvpc"
  execution_role_arn       = "${aws_iam_role.ecs_task_execution_role.arn}"

  container_definitions = <<DEFINITIONS
[
  {
    "name": "setup-task",
    "image": "278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-post-process:latest",
    "essential": true,
    "environment": [
      {
        "name": "JOB_SERVER_HOST",
        "value": "job-server.local"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/fargate/service/setup-task",
        "awslogs-region": "eu-west-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }
]
DEFINITIONS
}

data "aws_ecs_task_definition" "setup_task" {
  task_definition = "${aws_ecs_task_definition.setup_task.family}"
}

resource "aws_ecs_service" "setup_task" {
  name = "setup-task"
  cluster = "${aws_ecs_cluster.setup.id}"
  launch_type = "EC2"
  desired_count = "1"

  network_configuration {
    subnets = ["${aws_subnet.setup.id}"]
    security_groups = ["${aws_security_group.setup.id}"]
  }

  # Track the latest ACTIVE revision
  task_definition = "${aws_ecs_task_definition.setup_task.family}:${max("${aws_ecs_task_definition.setup_task.revision}", "${data.aws_ecs_task_definition.setup_task.revision}")}"
}

# Logging setup-task to CloudWatch
resource "aws_cloudwatch_log_group" "setup_task_logs" {
  name = "/fargate/service/setup-task"
  retention_in_days = "14"
}
