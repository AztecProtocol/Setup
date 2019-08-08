output "local_service_discovery_id" {
  value = "${aws_service_discovery_private_dns_namespace.local.id}"
}

output "ecs_task_execution_role_arn" {
  value = "${aws_iam_role.ecs_task_execution_role.arn}"
}

output "ecs_cluster_setup_id" {
  value = "${aws_ecs_cluster.setup.id}"
}

output "subnet_setup_id" {
  value = "${aws_subnet.setup.id}"
}

output "security_group_setup_id" {
  value = "${aws_security_group.setup.id}"
}

output "security_group_setup_public_id" {
  value = "${aws_security_group.setup_public.id}"
}
