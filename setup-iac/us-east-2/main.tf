terraform {
  backend "s3" {
    bucket = "aztec-terraform"
    key    = "setup/setup-iac/us-east-2"
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
  region  = "us-east-2"
}

# Create a vpc.
resource "aws_vpc" "setup" {
  cidr_block           = "10.2.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "setup"
  }
}

# We create an addional CIDR block to expand beyond initial /16 limits.
resource "aws_vpc_ipv4_cidr_block_association" "cidr1" {
  vpc_id     = aws_vpc.setup.id
  cidr_block = "10.3.0.0/16"
}

### PUBLIC NETWORK

# Public subnets in each availability zone.
/*
resource "aws_subnet" "public_az1" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.2.0.0/18"
  availability_zone = "us-east-2a"

  tags = {
    Name = "setup-az1"
  }
}

resource "aws_subnet" "public_az2" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.2.64.0/18"
  availability_zone = "us-east-2b"

  tags = {
    Name = "setup-az2"
  }
}

resource "aws_subnet" "public_az3" {
  vpc_id            = "${aws_vpc.setup.id}"
  cidr_block        = "10.2.128.0/18"
  availability_zone = "us-east-2c"

  tags = {
    Name = "setup-az3"
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

resource "aws_eip" "nat_eip_az3" {
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

resource "aws_nat_gateway" "gw_az3" {
  allocation_id = "${aws_eip.nat_eip_az3.id}"
  subnet_id     = "${aws_subnet.public_az3.id}"
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

resource "aws_security_group_rule" "setup_public_allow_all_vpc" {
  type              = "ingress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["10.0.0.0/8"]
  security_group_id = "${aws_security_group.public.id}"
}

resource "aws_security_group_rule" "setup_public_allow_all_outgoing" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = "${aws_security_group.public.id}"
}
*/

### PRIVATE NETWORK

# Private subnets in each avilability zone.
resource "aws_subnet" "private_az1" {
  vpc_id            = aws_vpc.setup.id
  cidr_block        = "10.3.0.0/18"
  availability_zone = "us-east-2a"

  tags = {
    Name = "setup-az1-private"
  }
}

resource "aws_subnet" "private_az2" {
  vpc_id            = aws_vpc.setup.id
  cidr_block        = "10.3.64.0/18"
  availability_zone = "us-east-2b"

  tags = {
    Name = "setup-az2-private"
  }
}

resource "aws_subnet" "private_az3" {
  vpc_id            = aws_vpc.setup.id
  cidr_block        = "10.3.128.0/18"
  availability_zone = "us-east-2c"

  tags = {
    Name = "setup-az3-private"
  }
}

# Private network routing tables, rules to NAT gateway, and subnet associations.
resource "aws_route_table" "private_az1" {
  vpc_id = aws_vpc.setup.id

  tags = {
    Name = "setup-private-az1"
  }
}

resource "aws_route_table" "private_az2" {
  vpc_id = aws_vpc.setup.id

  tags = {
    Name = "setup-private-az2"
  }
}

resource "aws_route_table" "private_az3" {
  vpc_id = aws_vpc.setup.id

  tags = {
    Name = "setup-private-az3"
  }
}

/*
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

resource "aws_route" "private_az3" {
  route_table_id         = "${aws_route_table.private_az3.id}"
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = "${aws_nat_gateway.gw_az3.id}"
}

*/
resource "aws_route_table_association" "subnet_association_az1" {
  subnet_id      = aws_subnet.private_az1.id
  route_table_id = aws_route_table.private_az1.id
}

resource "aws_route_table_association" "subnet_association_az2" {
  subnet_id      = aws_subnet.private_az2.id
  route_table_id = aws_route_table.private_az2.id
}

resource "aws_route_table_association" "subnet_association_az3" {
  subnet_id      = aws_subnet.private_az3.id
  route_table_id = aws_route_table.private_az3.id
}

# Private security group.
resource "aws_security_group" "private" {
  name   = "setup-private"
  vpc_id = aws_vpc.setup.id

  ingress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }

  ingress {
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["10.0.0.0/8"]
  }

  ingress {
    protocol    = "tcp"
    from_port   = 22
    to_port     = 22
    cidr_blocks = ["${data.terraform_remote_state.setup_iac.outputs.bastion_private_ip}/32"]
  }

  ingress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
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
  vpc_id              = aws_vpc.setup.id
  service_name        = "com.amazonaws.us-east-2.ecs-agent"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.private_az1.id}", "${aws_subnet.private_az2.id}", "${aws_subnet.private_az3.id}"]
}

resource "aws_vpc_endpoint" "ecs_telemetry" {
  vpc_id              = aws_vpc.setup.id
  service_name        = "com.amazonaws.us-east-2.ecs-telemetry"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.private_az1.id}", "${aws_subnet.private_az2.id}", "${aws_subnet.private_az3.id}"]
}

resource "aws_vpc_endpoint" "ecs" {
  vpc_id              = aws_vpc.setup.id
  service_name        = "com.amazonaws.us-east-2.ecs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.private_az1.id}", "${aws_subnet.private_az2.id}", "${aws_subnet.private_az3.id}"]
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.setup.id
  service_name        = "com.amazonaws.us-east-2.logs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.private_az1.id}", "${aws_subnet.private_az2.id}", "${aws_subnet.private_az3.id}"]
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.setup.id
  service_name        = "com.amazonaws.us-east-2.ecr.api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.private_az1.id}", "${aws_subnet.private_az2.id}", "${aws_subnet.private_az3.id}"]
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.setup.id
  service_name        = "com.amazonaws.us-east-2.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [
    "${aws_security_group.private.id}",
  ]

  subnet_ids = ["${aws_subnet.private_az1.id}", "${aws_subnet.private_az2.id}", "${aws_subnet.private_az3.id}"]
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.setup.id
  service_name      = "com.amazonaws.us-east-2.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = ["${aws_route_table.private_az1.id}", "${aws_route_table.private_az2.id}", "${aws_route_table.private_az3.id}"]
}

# Create our cluster.
resource "aws_ecs_cluster" "main" {
  name = "main"
}

resource "aws_key_pair" "instance_key_pair" {
  key_name   = "instance-key-pair"
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDagCvr/+CA1jmFaJf+e9+Kw6iwfhvaKOpfbGEl5zLgB+rum5L4Kga6Jow1gLQeMnAHfqc2IgpsU4t04c8PYApAt8AWNDL+KxMiFytfjKfJ2DZJA73CYkFnkfnMtU+ki+JG9dAHd6m7ShtCSzE5n6EDO2yWCVWQfqE3dcnpwrymSWkJYrbxzeOixiNZ4f1nD9ddvFvTWGB4l+et5SWgeIaYgJYDqTI2teRt9ytJiDGrCWXs9olHsCZOL6TEJPUQmNekwBkjMAZ4TmbBMjwbUlIxOpW2UxzlONcNn7IlRcGQg0Gdbkpo/zOlCNXsvacvnphDk5vKKaQj+aQiG916LU5P charlie@aztecprotocol.com"
}

resource "aws_key_pair" "build_instance" {
  key_name   = "build-instance"
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC/MQzU7KxG1Cl+Jr/aALPwAjH+MnBwXxq2M+zMFTmmKAfltOy3vbIh5zA/7yWCQkCgGYDFQSMPW/+4UPnllX8m/P7g9/Z8+e2hWmUDmzzkPNblz+557LS0JjaC7Sb4YCwv8lc3dgw9hzu4AWxfYlWc9xT/W9uG6ct3LUnx9ZPvvp8z49Px8hDoasHqIpLli3S8ULRBs3R7Ent5DCDxWPH2BEZLEZU09A6DLf0ACzYzn3uPQt+9bxGaybeHwhr5p6o193GOCZDCmlyd0mQBKD5HZbAbnpFPWNIJvSMTr55D0mLGx0Lobdo9BhZAlu2Vu+84WZflIegjiqshhyhwVNK/520rTCVY2rcGNk2333WD32Nrw/9uc1aL8qk3u8pzc8outbFy1htJgaFabY7oR5UV505H+xZlt78FfDAhprTA5L4wpRpx6jL4XiNN30bA/H3uJ8+luQhqN1DqkXvM4ak/WoAgwgCrMf5fCTb6Awx6N6lNU5ZxhoE325jnz2F0avM= stefan@aztecprotocol.com"
}

### PEERING

# us-east-2 side of the peering configuration. VPC, subnets, security group, routes to eu-west-2.
resource "aws_vpc_peering_connection" "peer" {
  vpc_id      = aws_vpc.setup.id
  peer_vpc_id = data.terraform_remote_state.setup_iac.outputs.vpc_id
  peer_region = "eu-west-2"
  auto_accept = false

  tags = {
    Name = "us-east-2-eu-west-2-peering"
    Side = "Requester"
  }
}

resource "aws_vpc_peering_connection_options" "peer" {
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id

  requester {
    allow_remote_vpc_dns_resolution = true
  }
}

# Routes to eu-west-2 subnets through peering connection.
resource "aws_route" "main_table_peer_public" {
  route_table_id            = aws_vpc.setup.main_route_table_id
  destination_cidr_block    = "10.0.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "main_table_peer_private" {
  route_table_id            = aws_vpc.setup.main_route_table_id
  destination_cidr_block    = "10.1.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "private_az1_peer_public" {
  route_table_id            = aws_route_table.private_az1.id
  destination_cidr_block    = "10.0.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "private_az1_peer_private" {
  route_table_id            = aws_route_table.private_az1.id
  destination_cidr_block    = "10.1.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "private_az2_peer_public" {
  route_table_id            = aws_route_table.private_az2.id
  destination_cidr_block    = "10.0.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "private_az2_peer_private" {
  route_table_id            = aws_route_table.private_az2.id
  destination_cidr_block    = "10.1.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "private_az3_peer_public" {
  route_table_id            = aws_route_table.private_az3.id
  destination_cidr_block    = "10.0.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "private_az3_peer_private" {
  route_table_id            = aws_route_table.private_az3.id
  destination_cidr_block    = "10.1.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

# eu-west-2 side of the peering configuration. Routes to us-east-2.
provider "aws" {
  alias   = "eu-west-2"
  profile = "default"
  region  = "eu-west-2"
}

resource "aws_vpc_peering_connection_accepter" "peer" {
  provider                  = "aws.eu-west-2"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
  auto_accept               = true

  tags = {
    Name = "us-east-2-eu-west-2-peering"
    Side = "Accepter"
  }
}

resource "aws_vpc_peering_connection_options" "accepter" {
  provider                  = "aws.eu-west-2"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id

  accepter {
    allow_remote_vpc_dns_resolution = true
  }
}

resource "aws_route" "from_peer_main" {
  provider                  = "aws.eu-west-2"
  route_table_id            = data.terraform_remote_state.setup_iac.outputs.vpc_main_route_table_id
  destination_cidr_block    = "10.3.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "from_peer_az1" {
  provider                  = "aws.eu-west-2"
  route_table_id            = data.terraform_remote_state.setup_iac.outputs.route_table_az1_private_id
  destination_cidr_block    = "10.3.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}

resource "aws_route" "from_peer_az2" {
  provider                  = "aws.eu-west-2"
  route_table_id            = data.terraform_remote_state.setup_iac.outputs.route_table_az2_private_id
  destination_cidr_block    = "10.3.0.0/16"
  vpc_peering_connection_id = aws_vpc_peering_connection.peer.id
}
