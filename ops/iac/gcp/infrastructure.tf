provider "google-beta" {
  project = var.project
  region = var.region
  zone = var.zone
}

provider "google" {
  project = var.project
  region = var.region
  zone = var.zone
}

resource "google_project_service" "compute" {
  service = "compute.googleapis.com"
}

resource "google_project_service" "dns" {
  service = "dns.googleapis.com"
}

resource "google_project_service" "service_networking" {
  service = "servicenetworking.googleapis.com"
}

resource "google_project_service" "container" {
  service = "container.googleapis.com"
}

resource "google_project_service" "logging" {
  service = "logging.googleapis.com"
}

resource "google_project_service" "redis" {
  service = "redis.googleapis.com"
}

resource "google_project_service" "monitoring" {
  service = "monitoring.googleapis.com"
}

/// DOMAIN

resource "google_dns_record_set" "app" {
  count = length(local.domains)
  project = var.top-project
  name = "${var.env}.${local.domains[count.index]}."
  type = "A"
  ttl = 300

  managed_zone = local.dns-zones[count.index]
  rrdatas = [
    google_compute_global_address.external[count.index].address
  ]
  depends_on = [google_project_service.dns]
}

resource "google_dns_record_set" "cdn" {
  count = length(local.domains)
  project = var.top-project
  name = "cdn-${var.env}.${local.domains[count.index]}."
  type = "A"
  ttl = 300
  managed_zone = local.dns-zones[count.index]
  rrdatas = [
    google_compute_global_address.cdn[count.index].address
  ]
  depends_on = [google_project_service.dns]
}

resource "google_compute_managed_ssl_certificate" "certificate" {
  count = length(local.domains)
  name = "cert${count.index > 0 ? count.index : ""}"

  managed {
    domains = [
      google_dns_record_set.app[count.index].name
    ]
  }
}

// NETWORK

resource "google_compute_network" "vpc_network" {
  name = "custom-network1"
  auto_create_subnetworks = false
  depends_on = [google_project_service.service_networking]
}

resource "google_compute_subnetwork" "subnet" {
  name = "subnet-1"
  network = google_compute_network.vpc_network.name
  ip_cidr_range = "192.168.1.0/24"
}

resource "google_compute_router" "router" {
  name = "router"
  network = google_compute_network.vpc_network.name
}

resource "google_compute_router_nat" "nat" {
  name = "nat-config"
  router = google_compute_router.router.name
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  nat_ip_allocate_option = "MANUAL_ONLY"
  nat_ips = [
    google_compute_address.outbound.self_link
  ]
  min_ports_per_vm = 128
  enable_dynamic_port_allocation = true
  enable_endpoint_independent_mapping = false
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_compute_firewall" "firewall" {
  name = "firewall"
  network = google_compute_network.vpc_network.name
  source_ranges = [
    "35.235.240.0/20"
  ]
  allow {
    protocol = "tcp"
    ports = [
      "22"
    ]
  }
}

resource "google_compute_address" "outbound" {
  name = "cluster-external-ip"
  depends_on = [google_project_service.service_networking]
}

resource "google_compute_global_address" "external" {
  count = length(local.domains)
  name = "external-ip${count.index > 0 ? count.index : ""}"
  depends_on = [google_project_service.service_networking]
}

resource "kubernetes_manifest" "pod_monitoring" {
  count = var.enable-prometheus-monitoring ? 1 : 0

  manifest = {
    apiVersion = "monitoring.googleapis.com/v1"
    kind = "PodMonitoring"
    metadata = {
      name = "pod-monitoring"
      namespace = kubernetes_namespace.app-namespace.metadata[0].name
    }
    spec = {
      selector = {
        matchLabels = {
          metrics_target = "true"
        }
      }
      endpoints = [
        {
          port = "container-port"
          path = "/metrics"
          interval = "${var.prometheus-scrape-interval}s"
        }
      ]
    }
  }
}

// CLUSTER

resource "google_container_cluster" "cluster" {
  name = "cluster"
  location = var.cluster-availability == "REGIONAL" ? var.region : var.zone

  //noinspection ConflictingProperties
  remove_default_node_pool = var.cluster-autopilot ? null : true
  enable_autopilot = var.cluster-autopilot ? true : null
  initial_node_count = var.cluster-initial-node-count

  private_cluster_config {
    enable_private_endpoint = false
    enable_private_nodes = true
    master_ipv4_cidr_block = "172.16.0.0/28"
    master_global_access_config {
      enabled = false
    }
  }

  ip_allocation_policy {
    cluster_ipv4_cidr_block = "10.64.0.0/14"
    services_ipv4_cidr_block = "10.68.0.0/20"
  }

  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS"
    ]
    managed_prometheus {
      enabled = true
    }
  }

  network = google_compute_network.vpc_network.name
  subnetwork = google_compute_subnetwork.subnet.name

  depends_on = [google_project_service.container, google_project_service.compute, google_compute_network.vpc_network]
}

resource "google_container_node_pool" "primary_nodes" {
  count = var.cluster-autopilot ? 0 : var.cluster-node-pools
  name = count.index == 0 ? "my-node-pool" : "my-node-pool${count.index}"
  # lifecycle {
  #   ignore_changes = [
  #     node_config
  #   ]
  # }
  location = google_container_cluster.cluster.location
  cluster = google_container_cluster.cluster.name

  upgrade_settings {
    strategy = "BLUE_GREEN"
    blue_green_settings {
      node_pool_soak_duration = "120s"
      standard_rollout_policy {
        batch_node_count = 1
        batch_soak_duration = "30s"
      }
    }
  }

  initial_node_count = 1
  autoscaling {
    min_node_count = var.cluster-min-nodes
    max_node_count = var.cluster-max-nodes
    location_policy = "BALANCED"
  }

  node_config {
    spot = var.spot_instances
    disk_size_gb = var.cluster-disk-size
    machine_type = var.cluster-machine-type
    oauth_scopes = [
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
      "https://www.googleapis.com/auth/trace.append",
    ]
  }
  depends_on = [google_container_cluster.cluster]
}

//REDIS

resource "google_redis_instance" "redis" {
  name = "redis"
  count = var.redis-enabled ? 1 : 0
  memory_size_gb = var.redis-memory-size
  tier = var.redis-high-availability ? "STANDARD_HA" : "BASIC"
  authorized_network = google_compute_network.vpc_network.id
  persistence_config {
    persistence_mode = "RDB"
    rdb_snapshot_period = "ONE_HOUR"
  }

  depends_on = [google_project_service.redis]
}


// DATABASE

resource "google_sql_database" "database" {
  name = "db"
  instance = google_sql_database_instance.instance.name
  depends_on = [google_project_service.compute]
  lifecycle {
    ignore_changes = [
      deletion_policy
    ]
  }
}

resource "google_compute_network" "private_network" {
  name = "private-network"
  depends_on = [google_project_service.service_networking]
}

resource "google_compute_global_address" "private_ip_address" {
  count = length(local.domains)
  name = "private-ip-address${count.index > 0 ? count.index : ""}"
  purpose = "VPC_PEERING"
  address_type = "INTERNAL"
  prefix_length = 16
  network = google_compute_network.vpc_network.id
}


resource "google_service_networking_connection" "private_vpc_connection" {
  network = google_compute_network.vpc_network.id
  service = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [
    for i, item in google_compute_global_address.private_ip_address : item.name
  ]
}

resource "random_password" "database_password" {
  length = 16
  special = true
  override_special = "_%@"
}

resource "random_password" "database_password_app" {
  length = 16
  special = true
  override_special = "_%@"
}

resource "google_sql_database_instance" "instance" {
  name = "db"
  database_version = var.database-version
  depends_on = [
    google_service_networking_connection.private_vpc_connection
  ]

  settings {
    edition = var.database-edition
    dynamic data_cache_config {
      for_each = var.database-edition == "ENTERPRISE_PLUS" ? [1] : []
      content {
        data_cache_enabled = true
      }
    }
    tier = var.database-tier
    availability_type = var.database-availability
    ip_configuration {
      private_network = google_compute_network.vpc_network.id
      dynamic authorized_networks {
        for_each = var.database-authorized-ips
        content {
          value = authorized_networks.value
        }
      }
    }
    backup_configuration {
      enabled = true
      point_in_time_recovery_enabled = true
    }
    database_flags {
      name = "max_connections"
      value = 10000
    }
    insights_config {
      query_insights_enabled = true
      record_application_tags = false
      record_client_address = false
      query_string_length = 2048
    }
  }
}

resource "google_sql_database_instance" "instance_replica" {
  count = var.database-replication ? 1 : 0
  name = "replica-db"
  database_version = var.database-version
  depends_on = [
    google_sql_database_instance.instance
  ]
  master_instance_name = "db"
  deletion_protection = false

  replica_configuration {
    failover_target = false
  }
  settings {
    edition = var.database-edition
    dynamic data_cache_config {
      for_each = var.database-edition == "ENTERPRISE_PLUS" ? [1] : []
      content {
        data_cache_enabled = true
      }
    }
    tier = var.database-replica-tier
    availability_type = "ZONAL"
    ip_configuration {
      private_network = google_compute_network.vpc_network.id
      dynamic authorized_networks {
        for_each = var.database-authorized-ips
        content {
          value = authorized_networks.value
        }
      }
    }
    backup_configuration {
      enabled = false
    }
    database_flags {
      name = "max_standby_archive_delay"
      value = 300000
      //5min
    }
    database_flags {
      name = "max_standby_streaming_delay"
      value = 300000
      //5min
    }
    database_flags {
      name = "max_connections"
      value = 10000
    }
    database_flags {
      name = "hot_standby_feedback"
      value = "on"
    }
    insights_config {
      query_insights_enabled = true
      record_application_tags = true
      record_client_address = true
      query_string_length = 4096

    }
  }
}

resource "google_sql_user" "users" {
  name = "postgres"
  instance = google_sql_database_instance.instance.name
  host = ""
  password = random_password.database_password.result
}

resource "google_sql_user" "app_user" {
  name = "app"
  instance = google_sql_database_instance.instance.name
  host = ""
  password = random_password.database_password_app.result
}

/// CDN

resource "google_compute_global_address" "cdn" {
  count = length(local.domains)
  name = "cdn-ip${count.index > 0 ? count.index : ""}"
  depends_on = [google_project_service.service_networking]
}

resource "google_storage_bucket" "cdn" {
  name = var.cdn-bucket != "" ? var.cdn-bucket : "cdn-${var.project}"
  location = var.bucket-location

  uniform_bucket_level_access = true

  cors {
    origin = [var.cors-origin != null ? var.cors-origin : "*"]
    method = [
      "GET",
      "HEAD",
      "OPTIONS",
    ]
  }

  website {
    main_page_suffix = "index.html"
    not_found_page = "index.html"
  }
  depends_on = [google_project_service.compute]
}

# Add the bucket as a CDN backend
resource "google_compute_backend_bucket" "cdn" {
  #  provider = google-beta
  name = google_storage_bucket.cdn.name
  bucket_name = google_storage_bucket.cdn.name
  enable_cdn = true
  compression_mode = "AUTOMATIC"

  cdn_policy {
    request_coalescing = true
    signed_url_cache_max_age_sec = 30*24*3600 #30 days
    client_ttl = 24*3600 #24 hours
    default_ttl = 30*24*3600 #30 days
    max_ttl = 30*24*3600 #30 days
    serve_while_stale = 7*24*3600 #7 days
    cache_mode = "CACHE_ALL_STATIC"
    negative_caching = true
  }

}

# Create HTTPS certificate
resource "google_compute_managed_ssl_certificate" "website" {
  count = length(local.domains)
  name = "cdn${count.index == 0 ? "" : count.index}"

  managed {
    domains = [
      google_dns_record_set.cdn[count.index].name
    ]
  }
}


# GCP URL MAP
resource "google_compute_url_map" "cdn" {
  name = "cdn"
  default_service = google_compute_backend_bucket.cdn.self_link
}

# GCP target proxy
resource "google_compute_target_https_proxy" "cdn" {
  name = "cdn"
  url_map = google_compute_url_map.cdn.self_link
  ssl_certificates = [
    for i, item in google_compute_managed_ssl_certificate.website : item.self_link
  ]
}

resource "google_compute_target_http_proxy" "cdn" {
  name = "cdn"
  url_map = google_compute_url_map.cdn.self_link
}

# GCP forwarding rule
resource "google_compute_global_forwarding_rule" "cdn-ssl" {
  count = length(local.domains)
  name = "cdn-ssl${count.index > 0 ? count.index : ""}"
  load_balancing_scheme = "EXTERNAL"
  ip_address = google_compute_global_address.cdn[count.index].address
  ip_protocol = "TCP"
  port_range = "443"
  target = google_compute_target_https_proxy.cdn.self_link
}

resource "google_compute_global_forwarding_rule" "cdn" {
  count = length(local.domains)
  name = "cdn${count.index > 0 ? count.index : ""}"
  load_balancing_scheme = "EXTERNAL"
  ip_address = google_compute_global_address.cdn[count.index].address
  ip_protocol = "TCP"
  port_range = "80"
  target = google_compute_target_http_proxy.cdn.self_link
}
resource "google_storage_bucket_iam_binding" "landing_page_iam_binding" {
  bucket = google_storage_bucket.cdn.name
  role = "roles/storage.objectViewer"
  members = [
    "allUsers"
  ]
}
resource "google_storage_bucket_object" "index" {
  name = "index.html"
  content = "hello"
  bucket = google_storage_bucket.cdn.name
  cache_control = "max-age=0, no-cache"
}

resource "google_compute_security_policy" "policy" {
  count = var.security-policy-disable ? 0 : 1
  name = "policy"
  #  provider = google-beta

  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = true
      rule_visibility = "STANDARD"
    }
  }
  rule {
    action = "deny(403)"
    priority = 700
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('scannerdetection-stable')"
      }
    }
  }
  rule {
    action = "deny(403)"
    priority = 800
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('protocolattack-stable', ['owasp-crs-v030001-id921170-protocolattack', 'owasp-crs-v030001-id921150-protocolattack', 'owasp-crs-v030001-id913101-scannerdetection'])"
      }
    }
  }
  rule {
    action = "allow"
    priority = 900
    header_action {
      request_headers_to_adds {
        header_name = "ip-blocked-country"
        header_value = "true"
      }
    }
    match {
      expr {
        expression = "'${join(",", var.ip-blocked-countries)}'.contains(origin.region_code)"
      }
    }
  }
  rule {
    action = "deny(404)"
    priority = 950
    match {
      expr {
        expression = "!request.path.matches('${replace(replace(join("|", formatlist("^%s/?$", keys(local.paths))), "^/*/?$", "^/$"), "*", ".*")}')"
      }
    }
  }
  rule {
    action = "throttle"
    preview = !var.rate-limiting
    priority = 1000
    match {
      expr {
        expression = "!request.path.matches('/graphql|/feed|/wallet|/rgs')"
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count = var.rate-limiting-config.requests
        interval_sec = var.rate-limiting-config.seconds
      }
    }
  }
  rule {
    action = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = [
          "*"
        ]
      }
    }
    description = "default rule"
  }
  depends_on = [google_project_service.compute]
}

resource "random_password" "jwt" {
  length = 16
  special = true
  override_special = "_%@"
}

resource "random_password" "rgs_key" {
  length = 16
  special = true
  override_special = "_%@"
}
