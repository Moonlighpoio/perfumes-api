output "instance_id" {
  value       = aws_instance.perfumes_api.id
  description = "ID de la instancia EC2."
}

output "public_ip" {
  value       = aws_eip.perfumes_api.public_ip
  description = "IP publica (Elastic IP) de la instancia."
}

output "security_group_id" {
  value       = aws_security_group.perfumes_api.id
  description = "ID del Security Group."
}
