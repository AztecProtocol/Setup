output "ecs_main_cluster_id" {
  value = "${aws_ecs_cluster.main.id}"
}

output "ecs_main_cluster_name" {
  value = "${aws_ecs_cluster.main.name}"
}

output "subnet_az1_private_id" {
  value = "${aws_subnet.private_az1.id}"
}

output "subnet_az2_private_id" {
  value = "${aws_subnet.private_az2.id}"
}

output "security_group_private_id" {
  value = "${aws_security_group.private.id}"
}

output "instance_key_pair_name" {
  value = "${aws_key_pair.instance_key_pair.key_name}"
}
