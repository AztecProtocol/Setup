output "vpc_id" {
  value = "${aws_vpc.setup.id}"
}

output "local_service_discovery_id" {
  value = "${aws_service_discovery_private_dns_namespace.local.id}"
}

output "ecs_task_execution_role_arn" {
  value = "${aws_iam_role.ecs_task_execution_role.arn}"
}

output "ecs_cluster_id" {
  value = "${aws_ecs_cluster.setup.id}"
}

output "ecs_cluster_name" {
  value = "${aws_ecs_cluster.setup.name}"
}

output "subnet_az1_id" {
  value = "${aws_subnet.setup.id}"
}

output "subnet_az2_id" {
  value = "${aws_subnet.setup_az2.id}"
}

output "subnet_az1_private_id" {
  value = "${aws_subnet.setup_az1_private.id}"
}

output "subnet_az2_private_id" {
  value = "${aws_subnet.setup_az2_private.id}"
}

output "security_group_private_id" {
  value = "${aws_security_group.setup.id}"
}

output "security_group_public_id" {
  value = "${aws_security_group.setup_public.id}"
}

output "alb_listener_arn" {
  value = "${aws_alb_listener.https_listener.arn}"
}

output "ecs_instance_profile_name" {
  value = "${aws_iam_instance_profile.ecs.name}"
}

output "ecs_instance_key_pair_name" {
  value = "${aws_key_pair.instance_key_pair.key_name}"
}
