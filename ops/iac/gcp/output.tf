output "outbound-ip" {
  value = google_compute_address.outbound.address
}

output "external-ip" {
  value = google_compute_global_address.external[0].address
}

output "cluster_name" {
  value = google_container_cluster.cluster.name
}

output "region" {
  value = google_sql_database_instance.instance.region
}

output "db-password" {
  value = random_password.database_password.result
  sensitive = true
}

output "jwt-secret" {
  value = random_password.jwt.result
  sensitive = true
}

output "rgs-key" {
  value = random_password.rgs_key.result
  sensitive = true
}
