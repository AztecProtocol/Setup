const m5Instances = [
  ['m5.metal', 96],
  ['m5.24xlarge', 96],
  ['m5.16xlarge', 64],
  ['m5.12xlarge', 48],
  ['m5.8xlarge', 32],
  ['m5.4xlarge', 16],
  ['m5.2xlarge', 8],
  ['m5.xlarge', 4],
  ['m5d.metal', 96],
  ['m5d.24xlarge', 96],
  ['m5d.16xlarge', 64],
  ['m5d.12xlarge', 48],
  ['m5d.8xlarge', 32],
  ['m5d.4xlarge', 16],
  ['m5d.2xlarge', 8],
  ['m5d.xlarge', 4],
];

// AMD machines are 70% as performant.
const m5aInstances = [
  ['m5a.24xlarge', 96],
  ['m5a.16xlarge', 64],
  ['m5a.12xlarge', 48],
  ['m5a.8xlarge', 32],
  ['m5a.4xlarge', 16],
  ['m5a.2xlarge', 8],
  ['m5a.xlarge', 4],
  ['m5ad.24xlarge', 96],
  ['m5ad.12xlarge', 48],
  ['m5ad.4xlarge', 16],
  ['m5ad.2xlarge', 8],
  ['m5ad.xlarge', 4],
].map(e => [e[0], Math.floor(e[1] * 0.7)]);

// Older m4 machines are 90% as performant.
const m4Instances = [
  ['m4.16xlarge', 64],
  ['m4.10xlarge', 40],
  ['m4.4xlarge', 16],
  ['m4.2xlarge', 8],
  ['m4.xlarge', 4],
].map(e => [e[0], Math.floor(e[1] * 0.9)]);

const r5Instances = [
  ['r5.metal', 96],
  ['r5.24xlarge', 96],
  ['r5.16xlarge', 64],
  ['r5.12xlarge', 48],
  ['r5.8xlarge', 32],
  ['r5.4xlarge', 16],
  ['r5.2xlarge', 8],
  ['r5.xlarge', 4],
  ['r5d.metal', 96],
  ['r5d.24xlarge', 96],
  ['r5d.16xlarge', 64],
  ['r5d.12xlarge', 48],
  ['r5d.8xlarge', 32],
  ['r5d.4xlarge', 16],
  ['r5d.2xlarge', 8],
  ['r5d.xlarge', 4],
];

// AMD machines are 70% as performant.
const r5aInstances = [
  ['r5a.24xlarge', 96],
  ['r5a.16xlarge', 64],
  ['r5a.12xlarge', 48],
  ['r5a.8xlarge', 32],
  ['r5a.4xlarge', 16],
  ['r5a.2xlarge', 8],
  ['r5a.xlarge', 4],
  ['r5ad.24xlarge', 96],
  ['r5ad.12xlarge', 48],
  ['r5ad.4xlarge', 16],
  ['r5ad.2xlarge', 8],
  ['r5ad.xlarge', 4],
].map(e => [e[0], Math.floor(e[1] * 0.7)]);

// Older m4 machines are 90% as performant.
const r4Instances = [
  ['r4.16xlarge', 64],
  ['r4.8xlarge', 32],
  ['r4.4xlarge', 16],
  ['r4.2xlarge', 8],
  ['r4.xlarge', 4],
].map(e => [e[0], Math.floor(e[1] * 0.9)]);

const instances = [
  ...m5Instances,
  // ...m5aInstances,
  // ...m4Instances,
  //...r5Instances,
  // ...r5aInstances,
  // ...r4Instances,
];

const availabilityZones = [
  ['us-east-2a', 'az1'],
  ['us-east-2b', 'az2'],
  ['us-east-2c', 'az3'],
];

const target = '576';
//const target = '1';
const price = '0.011';

const header = (target, price) => `
resource "aws_spot_fleet_request" "main" {
  iam_fleet_role                      = data.terraform_remote_state.setup_iac.outputs.ecs_spot_fleet_role_arn
  allocation_strategy                 = "capacityOptimized"
  target_capacity                     = "${target}"
  spot_price                          = "${price}"
  terminate_instances_with_expiration = true
  valid_until                         = "2020-01-01T00:00:00Z"`;

const template = ([instanceType, weight], [availabilityZone, az]) => `
  launch_specification {
    weighted_capacity      = ${weight}
    ami                    = "ami-0fbd313043845c4f2"
    instance_type          = "${instanceType}"
    subnet_id              = data.terraform_remote_state.setup_iac_us_east_2.outputs.subnet_${az}_private_id
    vpc_security_group_ids = [data.terraform_remote_state.setup_iac_us_east_2.outputs.security_group_private_id]
    iam_instance_profile   = data.terraform_remote_state.setup_iac.outputs.ecs_instance_profile_name
    key_name               = data.terraform_remote_state.setup_iac_us_east_2.outputs.instance_key_pair_name
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
    ignore_changes = [valid_until]
  }
}`;

console.log(header(target, price));
instances.forEach(instance => availabilityZones.forEach(az => console.log(template(instance, az))));
console.log(footer);
