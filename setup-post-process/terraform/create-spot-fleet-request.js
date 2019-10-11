const r5Instances = [
  ['r5.metal', 96],
  ['r5.24xlarge', 96],
  ['r5.16xlarge', 64],
  ['r5.12xlarge', 48],
  ['r5.8xlarge', 32],
  ['r5.4xlarge', 16],
  ['r5.2xlarge', 8],
  ['r5.xlarge', 4],
];

const instances = [...r5Instances];

const availabilityZones = [['us-east-2a', 'az1'], ['us-east-2b', 'az2'], ['us-east-2c', 'az3']];

const target = '576';
const price = '0.011';

const header = (target, price) => `
resource "aws_spot_fleet_request" "main" {
  iam_fleet_role                      = "\${data.terraform_remote_state.setup_iac.outputs.ecs_spot_fleet_role_arn}"
  allocation_strategy                 = "capacityOptimized"
  target_capacity                     = "${target}"
  spot_price                          = "${price}"
  terminate_instances_with_expiration = true
  valid_until                         = "2020-01-01T00:00:00Z"`;

const template = ([instanceType, weight], [availabilityZone, az]) => `
  launch_specification {
    weighted_capacity      = ${weight}
    ami                    = "ami-0918be4c91697b460"
    instance_type          = "${instanceType}"
    subnet_id              = "\${data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_${az}_private_id}"
    vpc_security_group_ids = ["\${data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id}"]
    iam_instance_profile   = "\${data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name}"
    key_name               = "\${data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name}"
    availability_zone      = "${availabilityZone}"

    user_data = <<USER_DATA
#!/bin/bash
echo ECS_CLUSTER=\${data.terraform_remote_state.setup_iac_us_east_2.outputs.ecs_main_cluster_name} >> /etc/ecs/ecs.config
echo 'ECS_INSTANCE_ATTRIBUTES={"group": "setup-post-process"}' >> /etc/ecs/ecs.config
USER_DATA

    tags = {
      Name = "setup-post-process-${availabilityZone}"
    }
  }`;

const footer = `
  lifecycle {
    ignore_changes = ["valid_until"]
  }
}`;

console.log(header(target, price));
instances.forEach(instance => availabilityZones.forEach(az => console.log(template(instance, az))));
console.log(footer);
