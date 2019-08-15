terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-post-processing"
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
  assume_role_policy = "${data.aws_iam_policy_document.fleet_assume_role_policy.json}"
}

resource "aws_iam_role_policy_attachment" "ec2_spot_fleet_policy" {
  role       = "${aws_iam_role.ec2_spot_fleet_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetRole"
}

/*
resource "aws_instance" "setup_task" {
  ami = "ami-013b322dbc79e9a6a"
  instance_type = "m5.metal"
  subnet_id = "${aws_subnet.setup.id}"
  vpc_security_group_ids = ["${aws_security_group.setup.id}"]
  iam_instance_profile = "${aws_iam_instance_profile.ecs.name}"
  associate_public_ip_address = true
  key_name = "${aws_key_pair.deployer.key_name}"

  user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${aws_ecs_cluster.setup.name} >> /etc/ecs/ecs.config
USER_DATA

  tags = {
    Name = "setup-task"
  }
}
*/

/*
resource "aws_instance" "setup_task_2" {
  ami                         = "ami-013b322dbc79e9a6a"
  instance_type               = "c5.large"
  subnet_id                   = "${aws_subnet.setup.id}"
  vpc_security_group_ids      = ["${aws_security_group.setup.id}"]
  iam_instance_profile        = "${aws_iam_instance_profile.ecs.name}"
  associate_public_ip_address = true
  key_name                    = "${aws_key_pair.deployer.key_name}"

  user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${aws_ecs_cluster.setup.name} >> /etc/ecs/ecs.config
USER_DATA

  tags = {
    Name = "setup-task"
  }
}
*/

/*
resource "aws_spot_fleet_request" "main" {
  iam_fleet_role = "${aws_iam_role.ec2_spot_fleet_role.arn}"
  spot_price = "20.00"
  allocation_strategy = "diversified"
  target_capacity = "1"
  terminate_instances_with_expiration = false

  launch_specification {
    ami = "ami-013b322dbc79e9a6a"
    instance_type = "r5.metal"
    spot_price = "20.00"
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

  tags = {
    Name = "setup-task"
  }
}
*/

resource "aws_ecs_task_definition" "setup_task" {
  family                   = "setup-task"
  requires_compatibilities = ["EC2"]
  network_mode             = "awsvpc"
  execution_role_arn       = "${data.terraform_remote_state.setup_iac.outputs.ecs_task_execution_role_arn}"

  container_definitions = <<DEFINITIONS
[
  {
    "name": "setup-task",
    "image": "278380418400.dkr.ecr.eu-west-2.amazonaws.com/setup-post-process:latest",
    "essential": true,
    "memoryReservation": 256,
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
  name          = "setup-task"
  cluster       = "${data.terraform_remote_state.setup_iac.outputs.ecs_cluster_id}"
  launch_type   = "EC2"
  desired_count = "1"

  network_configuration {
    subnets         = ["${data.terraform_remote_state.setup_iac.outputs.subnet_az1_id}"]
    security_groups = ["${data.terraform_remote_state.setup_iac.outputs.security_group_private_id}"]
  }

  # Track the latest ACTIVE revision
  task_definition = "${aws_ecs_task_definition.setup_task.family}:${max("${aws_ecs_task_definition.setup_task.revision}", "${data.aws_ecs_task_definition.setup_task.revision}")}"
}

# Logging setup-task to CloudWatch
resource "aws_cloudwatch_log_group" "setup_task_logs" {
  name              = "/fargate/service/setup-task"
  retention_in_days = "14"
}
