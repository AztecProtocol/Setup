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

# Create a vpc.
resource "aws_vpc" "setup" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "setup"
  }
}

# We create an addional CIDR block to expand beyond initial /16 limits.
resource "aws_vpc_ipv4_cidr_block_association" "cidr1" {
  vpc_id     = "${aws_vpc.setup.id}"
  cidr_block = "10.1.0.0/16"
}

### PUBLIC NETWORK

# Public subnets in each availability zone.
resource "aws_subnet" "public_az1" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.0.0.0/17"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "setup-az1"
  }
}

resource "aws_subnet" "public_az2" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.0.128.0/17"
  availability_zone = "eu-west-2b"

  tags = {
    Name = "setup-az2"
  }
}

# Internet gateway.
resource "aws_internet_gateway" "gw" {
  vpc_id = "${aws_vpc.setup.id}"

  tags = {
    Name = "setup"
  }
}

# NAT gateway.
resource "aws_eip" "nat_eip_az1" {
  vpc        = true
  depends_on = ["aws_internet_gateway.gw"]
}

resource "aws_eip" "nat_eip_az2" {
  vpc        = true
  depends_on = ["aws_internet_gateway.gw"]
}

resource "aws_nat_gateway" "gw_az1" {
  allocation_id = "${aws_eip.nat_eip_az1.id}"
  subnet_id     = "${aws_subnet.public_az1.id}"
  depends_on    = ["aws_internet_gateway.gw"]
}

resource "aws_nat_gateway" "gw_az2" {
  allocation_id = "${aws_eip.nat_eip_az2.id}"
  subnet_id     = "${aws_subnet.public_az2.id}"
  depends_on    = ["aws_internet_gateway.gw"]
}

# Route main routing table default traffic through gateway.
resource "aws_route" "internet_access" {
  route_table_id         = "${aws_vpc.setup.main_route_table_id}"
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = "${aws_internet_gateway.gw.id}"
}

# Public security group and rules.
resource "aws_security_group" "public" {
  name   = "setup-public"
  vpc_id = "${aws_vpc.setup.id}"

  tags = {
    Name = "setup-public"
  }
}

resource "aws_security_group_rule" "public_allow_ssh" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["82.163.119.138/32", "217.169.11.246/32"]
  security_group_id = "${aws_security_group.public.id}"
}

resource "aws_security_group_rule" "setup_public_allow_https" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = "${aws_security_group.public.id}"
}

// Check this is needed. I think it is as it allows return traffic from private subnet.
resource "aws_security_group_rule" "setup_public_allow_setup_private" {
  type                     = "ingress"
  from_port                = 0
  to_port                  = 0
  protocol                 = "-1"
  source_security_group_id = "${aws_security_group.private.id}"
  security_group_id        = "${aws_security_group.public.id}"
}

// Check this is needed. I think it is as it allows the ALB to return traffic to internet.
resource "aws_security_group_rule" "setup_public_allow_all_outgoing" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = "${aws_security_group.public.id}"
}

### PRIVATE NETWORK

# Private subnets in each avilability zone.
resource "aws_subnet" "private_az1" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.1.0.0/17"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "setup-az1-private"
  }
}

resource "aws_subnet" "private_az2" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.1.128.0/17"
  availability_zone = "eu-west-2b"

  tags = {
    Name = "setup-az2-private"
  }
}

# Private network routing tables, rules to NAT gateway, and subnet associations.
resource "aws_route_table" "private_az1" {
  vpc_id = "${aws_vpc.setup.id}"

  tags = {
    Name = "setup-private-az1"
  }
}

resource "aws_route_table" "private_az2" {
  vpc_id = "${aws_vpc.setup.id}"

  tags = {
    Name = "setup-private-az2"
  }
}

resource "aws_route" "private_az1" {
  route_table_id         = "${aws_route_table.private_az1.id}"
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = "${aws_nat_gateway.gw_az1.id}"
}

resource "aws_route" "private_az2" {
  route_table_id         = "${aws_route_table.private_az2.id}"
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = "${aws_nat_gateway.gw_az2.id}"
}

resource "aws_route_table_association" "subnet_association_az1" {
  subnet_id      = "${aws_subnet.private_az1.id}"
  route_table_id = "${aws_route_table.private_az1.id}"
}

resource "aws_route_table_association" "subnet_association_az2" {
  subnet_id      = "${aws_subnet.private_az2.id}"
  route_table_id = "${aws_route_table.private_az2.id}"
}

# Private security group.
resource "aws_security_group" "private" {
  name   = "setup-private"
  vpc_id = "${aws_vpc.setup.id}"

  ingress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }

  ingress {
    protocol        = "tcp"
    from_port       = 80
    to_port         = 80
    security_groups = ["${aws_security_group.public.id}"]
  }

  ingress {
    protocol    = "tcp"
    from_port   = 22
    to_port     = 22
    cidr_blocks = ["${aws_instance.bastion.private_ip}/32"]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "setup-private"
  }
}

# Private link endpoint interfaces to get access to AWS services.
resource "aws_vpc_endpoint" "ecs_agent" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecs-agent"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.public_az1.id}"]
}

resource "aws_vpc_endpoint" "ecs_telemetry" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecs-telemetry"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.public_az1.id}"]
}

resource "aws_vpc_endpoint" "ecs" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.public_az1.id}"]
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.logs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.public_az1.id}"]
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecr.api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.public_az1.id}"]
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = "${aws_vpc.setup.id}"
  service_name        = "com.amazonaws.eu-west-2.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.public_az1.id}"]
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
  # container_insights = true
}

# Create our load balancer.
data "aws_iam_policy_document" "alb_log_policy" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::aztec-logs/setup-alb-logs/AWSLogs/*"]
    principals {
      type        = "AWS"
      identifiers = ["652711504416"]
    }
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "aztec-logs"
  acl    = "private"
  policy = "${data.aws_iam_policy_document.alb_log_policy.json}"
}

resource "aws_alb" "setup" {
  name               = "setup"
  internal           = false
  load_balancer_type = "application"
  security_groups    = ["${aws_security_group.public.id}"]
  subnets = [
    "${aws_subnet.public_az1.id}",
    "${aws_subnet.public_az2.id}"
  ]

  access_logs {
    bucket  = "${aws_s3_bucket.logs.bucket}"
    prefix  = "setup-alb-logs"
    enabled = true
  }

  tags = {
    Name = "setup"
  }
}

resource "aws_alb_listener" "https_listener" {
  load_balancer_arn = "${aws_alb.setup.arn}"
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = "${aws_acm_certificate_validation.cert.certificate_arn}"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found."
      status_code  = "404"
    }
  }
}

# ALB DNS entry.
resource "aws_route53_record" "setup" {
  zone_id = "Z1XXO7GDQEVT6B"
  name    = "setup-staging"
  type    = "A"
  alias {
    name                   = "${aws_alb.setup.dns_name}"
    zone_id                = "${aws_alb.setup.zone_id}"
    evaluate_target_health = true
  }
}

# QR Code DNS entry and redirection.
resource "aws_s3_bucket" "qr_redirect" {
  bucket = "qr.aztecprotocol.com"
  acl    = "private"

  website {
    index_document = "index.html"
    routing_rules  = <<EOF
[{
    "Redirect": {
      "Protocol": "https",
      "HostName": "aztecprotocol.us7.list-manage.com",
      "ReplaceKeyWith": "/subscribe?u=0f5fa2f22c3349ec01c3d1fdc&id=1b8d51cab0"
    }
}]
EOF
  }
}

resource "aws_route53_record" "qr" {
  zone_id = "Z1XXO7GDQEVT6B"
  name    = "qr"
  type    = "A"
  alias {
    name                   = "${aws_s3_bucket.qr_redirect.website_domain}"
    zone_id                = "${aws_s3_bucket.qr_redirect.hosted_zone_id}"
    evaluate_target_health = true
  }
}

# Certificate management.
resource "aws_acm_certificate" "cert" {
  domain_name               = "aztecprotocol.com"
  subject_alternative_names = ["*.aztecprotocol.com"]
  validation_method         = "DNS"
  tags = {
    Name = "aztecprotocol.com"
  }
}

resource "aws_route53_record" "cert_validation" {
  name    = "${aws_acm_certificate.cert.domain_validation_options.0.resource_record_name}"
  type    = "${aws_acm_certificate.cert.domain_validation_options.0.resource_record_type}"
  zone_id = "Z1XXO7GDQEVT6B"
  records = ["${aws_acm_certificate.cert.domain_validation_options.0.resource_record_value}"]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "cert" {
  certificate_arn = "${aws_acm_certificate.cert.arn}"

  validation_record_fqdns = [
    "${aws_route53_record.cert_validation.fqdn}",
  ]
}

# EC2 instances roles, policies, keys.
data "aws_iam_policy_document" "instance_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "setup_ecs_instance" {
  name               = "setup-ecs-instance"
  assume_role_policy = "${data.aws_iam_policy_document.instance_assume_role_policy.json}"
}

resource "aws_iam_instance_profile" "ecs" {
  name = "setup-ecs-instance"
  role = "${aws_iam_role.setup_ecs_instance.name}"
}

resource "aws_iam_policy_attachment" "ecs_instance" {
  name       = "setup-ecs-instance"
  roles      = ["${aws_iam_role.setup_ecs_instance.name}"]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_key_pair" "instance_key_pair" {
  key_name   = "setup-instance-key-pair"
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDagCvr/+CA1jmFaJf+e9+Kw6iwfhvaKOpfbGEl5zLgB+rum5L4Kga6Jow1gLQeMnAHfqc2IgpsU4t04c8PYApAt8AWNDL+KxMiFytfjKfJ2DZJA73CYkFnkfnMtU+ki+JG9dAHd6m7ShtCSzE5n6EDO2yWCVWQfqE3dcnpwrymSWkJYrbxzeOixiNZ4f1nD9ddvFvTWGB4l+et5SWgeIaYgJYDqTI2teRt9ytJiDGrCWXs9olHsCZOL6TEJPUQmNekwBkjMAZ4TmbBMjwbUlIxOpW2UxzlONcNn7IlRcGQg0Gdbkpo/zOlCNXsvacvnphDk5vKKaQj+aQiG916LU5P charlie@aztecprotocol.com"
}

# Bastion
resource "aws_instance" "bastion" {
  ami                         = "ami-0d8e27447ec2c8410"
  instance_type               = "t2.nano"
  subnet_id                   = "${aws_subnet.public_az1.id}"
  vpc_security_group_ids      = ["${aws_security_group.public.id}"]
  iam_instance_profile        = "${aws_iam_instance_profile.ecs.name}"
  associate_public_ip_address = true
  key_name                    = "${aws_key_pair.instance_key_pair.key_name}"
  availability_zone           = "eu-west-2a"

  tags = {
    Name = "bastion"
  }
}

resource "aws_route53_record" "bastion" {
  zone_id = "Z1XXO7GDQEVT6B"
  name    = "bastion"
  type    = "A"
  ttl     = 300
  records = ["${aws_instance.bastion.public_ip}"]
}
