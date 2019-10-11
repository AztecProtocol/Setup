
resource "aws_spot_fleet_request" "main" {
  iam_fleet_role                      = "${data.terraform_remote_state.setup_iac.outputs.ecs_spot_fleet_role_arn}"
  allocation_strategy                 = "capacityOptimized"
  target_capacity                     = "576"
  spot_price                          = "0.011"
  terminate_instances_with_expiration = true
  valid_until                         = "2020-01-01T00:00:00Z"

  launch_specification {
    weighted_capacity      = 96
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.metal"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 96
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.metal"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 96
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.metal"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  launch_specification {
    weighted_capacity      = 96
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.24xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 96
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.24xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 96
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.24xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  launch_specification {
    weighted_capacity      = 64
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.16xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 64
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.16xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 64
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.16xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  launch_specification {
    weighted_capacity      = 48
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.12xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 48
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.12xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 48
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.12xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  launch_specification {
    weighted_capacity      = 32
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.8xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 32
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.8xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 32
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.8xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  launch_specification {
    weighted_capacity      = 16
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.4xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 16
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.4xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 16
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.4xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  launch_specification {
    weighted_capacity      = 8
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.2xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 8
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.2xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 8
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.2xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  launch_specification {
    weighted_capacity      = 4
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az1_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2a"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2a"
    }
  }

  launch_specification {
    weighted_capacity      = 4
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az2_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2b"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2b"
    }
  }

  launch_specification {
    weighted_capacity      = 4
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "r5.xlarge"
    subnet_id              = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_az3_private_id}"
    vpc_security_group_ids = ["${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "us-east-2c"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-us-east-2c"
    }
  }

  lifecycle {
    ignore_changes = ["valid_until"]
  }
}
