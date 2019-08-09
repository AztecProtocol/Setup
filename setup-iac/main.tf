terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-iac"
    region = "eu-west-2"
  }
}

provider "aws" {
  profile = "default"
  region  = "eu-west-2"
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
  cidr_block        = "10.0.0.0/17"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "setup-az1"
  }
}

resource "aws_subnet" "setup_az2" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.0.128.0/17"
  availability_zone = "eu-west-2b"

  tags = {
    Name = "setup-az2"
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
    protocol    = "tcp"
    from_port   = 22
    to_port     = 22
    cidr_blocks = ["82.163.119.138/32", "217.169.11.246/32"]
  }

  ingress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }

  ingress {
    protocol        = "-1"
    from_port       = 0
    to_port         = 0
    security_groups = ["${aws_security_group.setup_public.id}"]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "setup"
  }
}

resource "aws_security_group" "setup_public" {
  name   = "setup-public"
  vpc_id = "${aws_vpc.setup.id}"

  tags = {
    Name = "setup-public"
  }
}

resource "aws_security_group_rule" "setup_public_allow_http" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = "${aws_security_group.setup_public.id}"
}

resource "aws_security_group_rule" "setup_public_allow_setup_private" {
  type                     = "ingress"
  from_port                = 0
  to_port                  = 0
  protocol                 = "-1"
  source_security_group_id = "${aws_security_group.setup.id}"
  security_group_id        = "${aws_security_group.setup_public.id}"
}

resource "aws_security_group_rule" "setup_public_allow_all_outgoing" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = "${aws_security_group.setup_public.id}"
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

# Service discovery.
resource "aws_service_discovery_private_dns_namespace" "local" {
  name        = "local"
  description = "local"
  vpc         = "${aws_vpc.setup.id}"
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

# Create our load balancer.
resource "aws_alb" "setup" {
  name               = "setup"
  internal           = false
  load_balancer_type = "application"
  security_groups    = ["${aws_security_group.setup_public.id}"]
  subnets = [
    "${aws_subnet.setup.id}",
    "${aws_subnet.setup_az2.id}"
  ]

  # access_logs {
  #   bucket  = "${aws_s3_bucket.lb_logs.bucket}"
  #   prefix  = "test-lb"
  #   enabled = true
  # }

  tags = {
    Name = "setup"
  }
}

resource "aws_alb_listener" "alb_listener" {
  load_balancer_arn = "${aws_alb.setup.arn}"
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found."
      status_code  = "404"
    }
  }
}

# DNS entry.
resource "aws_route53_record" "setup" {
  zone_id = "Z1XXO7GDQEVT6B"
  name    = "setup"
  type    = "A"
  alias {
    name                   = "${aws_alb.setup.dns_name}"
    zone_id                = "${aws_alb.setup.zone_id}"
    evaluate_target_health = true
  }
}
