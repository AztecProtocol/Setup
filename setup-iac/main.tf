# Define the Terraform configuration settings.
terraform {
  # Remote backend configuration for state storage in S3.
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-iac.tfstate" # Standardizing the key to include .tfstate
    region = "eu-west-2"
  }
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "3.74.2"
    }
  }
}

# AWS Provider configuration.
provider "aws" {
  profile = "default"
  region  = "eu-west-2"
}

# --- CORE VPC NETWORK ---

# Create the main Virtual Private Cloud (VPC).
resource "aws_vpc" "setup" {
  cidr_block             = "10.0.0.0/16"
  enable_dns_support     = true
  enable_dns_hostnames   = true

  tags = {
    Name = "setup-vpc"
  }
}

# Expand the VPC with an additional CIDR block for the private network space.
resource "aws_vpc_ipv4_cidr_block_association" "cidr_private_block" {
  vpc_id     = aws_vpc.setup.id
  cidr_block = "10.1.0.0/16" # Used for private subnets
}

# --- PUBLIC NETWORK ---

# Public subnets in two Availability Zones (AZs).
resource "aws_subnet" "public_az1" {
  vpc_id                  = aws_vpc.setup.id
  cidr_block              = "10.0.0.0/17"
  availability_zone       = "eu-west-2a"
  # Resources launched into this public subnet must have a public IP for internet access.
  map_public_ip_on_launch = true 

  tags = {
    Name = "setup-public-az1"
  }
}

resource "aws_subnet" "public_az2" {
  vpc_id                  = aws_vpc.setup.id
  cidr_block              = "10.0.128.0/17"
  availability_zone       = "eu-west-2b"
  map_public_ip_on_launch = true

  tags = {
    Name = "setup-public-az2"
  }
}

# Internet Gateway (IGW) for public subnet internet access.
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.setup.id

  tags = {
    Name = "setup-igw"
  }
}

# Elastic IPs for NAT Gateways (one per AZ for redundancy).
resource "aws_eip" "nat_eip" {
  count = 2
  vpc   = true
  # Ensure IGW is created before allocating EIPs for NAT.
  depends_on = [aws_internet_gateway.gw]
}

# NAT Gateways in each public subnet for private subnet internet access.
resource "aws_nat_gateway" "gw" {
  count         = 2
  allocation_id = aws_eip.nat_eip[count.index].id
  # Map NAT Gateway to the public subnets
  subnet_id     = count.index == 0 ? aws_subnet.public_az1.id : aws_subnet.public_az2.id
  depends_on    = [aws_internet_gateway.gw]
  
  tags = {
    Name = "setup-nat-gw-az${count.index + 1}"
  }
}

# Route the main VPC route table (often associated with the Public subnets by default)
# to use the Internet Gateway for 0.0.0.0/0 traffic.
resource "aws_route" "public_internet_access" {
  route_table_id         = aws_vpc.setup.main_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.gw.id
}

# Public Security Group and Rules.
resource "aws_security_group" "public" {
  name        = "setup-public-sg"
  description = "Allows HTTP/S and optionally SSH (from restricted ranges) access to public resources."
  vpc_id      = aws_vpc.setup.id

  # Ingress rules for Web traffic
  ingress {
    type        = "ingress"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP from anywhere"
  }

  ingress {
    type        = "ingress"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS from anywhere"
  }
  
  # WARNING: 0.0.0.0/0 SSH Access REMOVED for security. Bastion access should be via known IPs.
  # Re-add only if absolutely necessary and highly restricted:
  # ingress {
  #   from_port   = 22
  #   to_port     = 22
  #   protocol    = "tcp"
  #   cidr_blocks = ["YOUR_TRUSTED_IP_RANGE/32"] 
  #   description = "Allow SSH from trusted IPs only"
  # }

  # Allow all outgoing traffic to the internet.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "setup-public-sg"
  }
}

# --- PRIVATE NETWORK ---

# Private subnets in two Availability Zones, using the extended 10.1.0.0/16 CIDR block.
resource "aws_subnet" "private_az1" {
  vpc_id                  = aws_vpc.setup.id
  cidr_block              = "10.1.0.0/17"
  availability_zone       = "eu-west-2a"
  map_public_ip_on_launch = false # Private subnets should not assign public IPs

  tags = {
    Name = "setup-private-az1"
  }
}

resource "aws_subnet" "private_az2" {
  vpc_id                  = aws_vpc.setup.id
  cidr_block              = "10.1.128.0/17"
  availability_zone       = "eu-west-2b"
  map_public_ip_on_launch = false

  tags = {
    Name = "setup-private-az2"
  }
}

# Private network routing tables (one per AZ).
resource "aws_route_table" "private" {
  count = 2
  vpc_id = aws_vpc.setup.id

  tags = {
    Name = "setup-private-rt-az${count.index + 1}"
  }
}

# Routes to NAT Gateway for internet-bound traffic from private subnets.
resource "aws_route" "private_nat" {
  count                  = 2
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.gw[count.index].id
}

# Associate private route tables with private subnets.
resource "aws_route_table_association" "private_az1_association" {
  subnet_id      = aws_subnet.private_az1.id
  route_table_id = aws_route_table.private[0].id
}

resource "aws_route_table_association" "private_az2_association" {
  subnet_id      = aws_subnet.private_az2.id
  route_table_id = aws_route_table.private[1].id
}

# Private Security Group.
resource "aws_security_group" "private" {
  name        = "setup-private-sg"
  description = "Allows traffic only from inside the VPC and Bastion host."
  vpc_id      = aws_vpc.setup.id
  
  # Ensure Bastion instance is created before referencing its IP here.
  depends_on = [aws_instance.bastion] 

  # Ingress: Allow all protocols and ports for communication within the Security Group (Self-referencing).
  ingress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    self        = true
    description = "Allow all from self"
  }

  # Ingress: Allow SSH/All traffic from the Bastion host (assuming the Bastion is the single jump-host).
  ingress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    # FIX: Use the Bastion's private IP as a /32 block for precise SSH/management access.
    cidr_blocks = ["${aws_instance.bastion.private_ip}/32"] 
    description = "Allow all traffic from Bastion private IP"
  }
  
  # Ingress: Allow internal VPC traffic on port 80.
  ingress {
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["10.0.0.0/8"] # Allow from within the entire VPC CIDR block (10.0.0.0/16 and 10.1.0.0/16)
    description = "Allow HTTP from internal VPC"
  }
  
  # Egress: Allow all outgoing traffic to the internet (via NAT Gateway).
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outgoing traffic"
  }

  tags = {
    Name = "setup-private-sg"
  }
}

# --- VPC ENDPOINTS (PrivateLink) ---

# Consolidated VPC Interface Endpoints using for_each for reduced code duplication.
# FIX: The subnet IDs are changed to PRIVATE subnets for correct placement.
locals {
  interface_endpoints = {
    ecs_agent     = "com.amazonaws.${var.aws_region}.ecs-agent"
    ecs_telemetry = "com.amazonaws.${var.aws_region}.ecs-telemetry"
    ecs           = "com.amazonaws.${var.aws_region}.ecs"
    logs          = "com.amazonaws.${var.aws_region}.logs"
    ecr_api       = "com.amazonaws.${var.aws_region}.ecr.api"
    ecr_dkr       = "com.amazonaws.${var.aws_region}.ecr.dkr"
  }
  # Placeholder for region variable to improve reusability
  aws_region = "eu-west-2" 
}

resource "aws_vpc_endpoint" "interface_endpoints" {
  for_each = local.interface_endpoints
  
  vpc_id              = aws_vpc.setup.id
  service_name        = each.value
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    aws_security_group.private.id,
  ]
  
  # Place Interface Endpoints in both Private Subnets for high availability.
  subnet_ids = [
    aws_subnet.private_az1.id, 
    aws_subnet.private_az2.id
  ]
  
  tags = {
    Name = "setup-vpce-${each.key}"
  }
}

# VPC Gateway Endpoint for S3.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.setup.id
  service_name      = "com.amazonaws.${local.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  # Associate with both private route tables for access. Main RT association is unnecessary if private subnets don't use it.
  route_table_ids   = [aws_route_table.private[0].id, aws_route_table.private[1].id]
  
  tags = {
    Name = "setup-vpce-s3"
  }
}

# --- SERVICE DISCOVERY, IAM, ECS, and ALB ---

# Service discovery for private DNS.
resource "aws_service_discovery_private_dns_namespace" "local" {
  name        = "local"
  description = "Local service discovery namespace"
  vpc         = aws_vpc.setup.id
  
  tags = {
    Name = "setup-local-ns"
  }
}

# IAM Role for EC2 Spot Fleet (remains largely unchanged).
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
  assume_role_policy = data.aws_iam_policy_document.fleet_assume_role_policy.json
}

resource "aws_iam_role_policy_attachment" "ec2_spot_fleet_policy" {
  role       = aws_iam_role.ec2_spot_fleet_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetRole"
}

# IAM Role for ECS Task Execution (remains largely unchanged).
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
  assume_role_policy = data.aws_iam_policy_document.assume_role_policy.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Cluster.
resource "aws_ecs_cluster" "setup" {
  name = "setup"
  setting {
    name  = "containerInsights"
    value = "enabled" # Uncommented and set to enabled for better monitoring.
  }
  tags = {
    Name = "setup-ecs-cluster"
  }
}

# ALB Access Logs S3 Bucket and Policy.
data "aws_iam_policy_document" "alb_log_policy" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::aztec-logs/*"]
    principals {
      type        = "AWS"
      # The ALB service principal for eu-west-2
      identifiers = ["652711504416"] 
    }
    # Ensure the policy is correctly formed to allow access logging.
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["${aws_alb.setup.arn}"]
    }
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "aztec-logs"
  acl    = "private"
  # Policy must be attached separately to a bucket.
  # Using the policy argument in aws_s3_bucket is deprecated in favor of aws_s3_bucket_policy.
  # For simplicity, keeping it here but noting the best practice change.
  policy = data.aws_iam_policy_document.alb_log_policy.json

  tags = {
    Name = "aztec-logs"
  }
}

# Application Load Balancer (ALB).
resource "aws_alb" "setup" {
  name               = "setup"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.public.id]
  subnets = [
    aws_subnet.public_az1.id,
    aws_subnet.public_az2.id
  ]

  access_logs {
    bucket  = aws_s3_bucket.logs.bucket
    prefix  = "setup-alb-logs"
    enabled = true
  }

  tags = {
    Name = "setup-alb"
  }
}

# HTTP Listener (redirects to HTTPS).
resource "aws_alb_listener" "http_listener" {
  load_balancer_arn = aws_alb.setup.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener (requires ACM Certificate).
resource "aws_alb_listener" "https_listener" {
  load_balancer_arn = aws_alb.setup.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  # FIX: Ensure the validation resource is used for the ARN to guarantee order.
  certificate_arn   = aws_acm_certificate_validation.cert.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found."
      status_code  = "404"
    }
  }
}

# --- ROUTE 53 DNS RECORDS ---

# Assuming 'Z1XXO7GDQEVT6B' is the existing hosted zone ID for 'aztecprotocol.com'.
locals {
  hosted_zone_id = "Z1XXO7GDQEVT6B"
}

# ALB DNS entries.
resource "aws_route53_record" "setup" {
  zone_id = local.hosted_zone_id
  name    = "setup-staging"
  type    = "A"
  alias {
    name                   = aws_alb.setup.dns_name
    zone_id                = aws_alb.setup.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "ignition" {
  zone_id = local.hosted_zone_id
  name    = "ignition"
  type    = "A"
  alias {
    name                   = aws_alb.setup.dns_name
    zone_id                = aws_alb.setup.zone_id
    evaluate_target_health = true
  }
}

# QR Code Redirection S3 Bucket.
resource "aws_s3_bucket" "qr_redirect" {
  bucket = "qr.aztecprotocol.com"
  acl    = "public-read" # ACL needed for S3 website redirects to work publicly

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
  tags = {
    Name = "qr-redirect-bucket"
  }
}

resource "aws_route53_record" "qr" {
  zone_id = local.hosted_zone_id
  name    = "qr"
  type    = "A"
  alias {
    name                   = aws_s3_bucket.qr_redirect.website_domain
    zone_id                = aws_s3_bucket.qr_redirect.hosted_zone_id
    evaluate_target_health = true
  }
}

# Enterprise Code Redirection S3 Bucket.
resource "aws_s3_bucket" "enterprise_redirect" {
  bucket = "enterprise.aztecprotocol.com"
  acl    = "public-read" # ACL needed for S3 website redirects to work publicly

  website {
    index_document = "index.html"
    routing_rules  = <<EOF
[{
    "Redirect": {
      "Protocol": "https",
      "HostName": "www.aztecprotocol.com",
      "ReplaceKeyWith": ""
    }
}]
EOF
  }
  tags = {
    Name = "enterprise-redirect-bucket"
  }
}

resource "aws_route53_record" "enterprise" {
  zone_id = local.hosted_zone_id
  name    = "enterprise"
  type    = "A"
  alias {
    name                   = aws_s3_bucket.enterprise_redirect.website_domain
    zone_id                = aws_s3_bucket.enterprise_redirect.hosted_zone_id
    evaluate_target_health = true
  }
}

# --- ACM Certificate Management ---

resource "aws_acm_certificate" "cert" {
  domain_name             = "aztecprotocol.com"
  subject_alternative_names = ["*.aztecprotocol.com"]
  validation_method       = "DNS"
  tags = {
    Name = "aztecprotocol.com-wildcard"
  }
  lifecycle {
    create_before_destroy = true
  }
}

# Route 53 records for ACM DNS validation.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      record = dvo.resource_record_value
      type  = dvo.resource_record_type
    }
  }

  zone_id = local.hosted_zone_id
  ttl     = 300

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  type            = each.value.type
}

# Validation resource that waits for the DNS records to be created and ACM to validate the certificate.
resource "aws_acm_certificate_validation" "cert" {
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# --- EC2 IAM & Bastion Host ---

# IAM Role for EC2 Instances (e.g., ECS Container Instances).
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
  name               = "setup-ecs-instance-role"
  assume_role_policy = data.aws_iam_policy_document.instance_assume_role_policy.json
}

resource "aws_iam_instance_profile" "ecs" {
  name = "setup-ecs-instance-profile"
  role = aws_iam_role.setup_ecs_instance.name
}

resource "aws_iam_policy_attachment" "ecs_instance" {
  name       = "setup-ecs-instance-policy-attachment"
  roles      = [aws_iam_role.setup_ecs_instance.name]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

# SSH Key Pair for Bastion and EC2 instances.
resource "aws_key_pair" "instance_key_pair" {
  key_name   = "setup-instance-key-pair"
  # WARNING: Hardcoding a public key is okay for provisioning, but sensitive keys should be managed securely.
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDagCvr/+CA1jmFaJf+e9+Kw6iwfhvaKOpfbGEl5zLgB+rum5L4Kga6Jow1gLQeMnAHfqc2IgpsU4t04c8PYApAt8AWNDL+KxMiFytfjKfJ2DZJA73CYkFnkfnMtU+ki+JG9dAHd6m7ShtCSzE5n6EDO2yWCVWQfqE3dcnpwrymSWkJYrbxzeOixiNZ4f1nD9ddvFvTWGB4l+et5SWgeIaYgJYDqTI2teRt9ytJiDGrCWXs9olHsCZOL6TEJPUQmNekwBkjMAZ4TmbBMjwbUlIxOpW2UxzlONcNn7IlRcGQg0Gdbkpo/zOlCNXsvacvnphDk5vKKaQj+aQiG916LU5P charlie@aztecprotocol.com"
}

# Bastion Host (Jump Box).
resource "aws_instance" "bastion" {
  ami                         = "ami-0d8e27447ec2c8410" # Ensure this AMI is current and correct for eu-west-2
  instance_type               = "t3.small"
  subnet_id                   = aws_subnet.public_az1.id
  vpc_security_group_ids      = [aws_security_group.public.id]
  iam_instance_profile        = aws_iam_instance_profile.ecs.name # Using the ECS profile, though a dedicated Bastion profile might be better.
  associate_public_ip_address = true
  key_name                    = aws_key_pair.instance_key_pair.key_name
  availability_zone           = "eu-west-2a"

  tags = {
    Name       = "bastion"
    prometheus = "enabled" # Clarity on the Prometheus tag's purpose
  }
}

# Route 53 record for the Bastion Host's public IP.
resource "aws_route53_record" "bastion" {
  zone_id = local.hosted_zone_id
  name    = "bastion"
  type    = "A"
  ttl     = 300
  records = [aws_instance.bastion.public_ip]
}
