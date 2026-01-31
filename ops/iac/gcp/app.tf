locals {
  _services = merge({
    "adapter" : merge({
      enabled = lookup(var.versions, "adapter", false)
      image = "${var.container-registry}/${var.container-registry-repository}/adapter:${lookup(var.versions, "adapter", "")}"
      requests = { cpu = "500m", memory = "256Mi" }
      limits = { memory = "512Mi" }
      metrics_enabled = true
      env-vars = merge({
        DEFAULT_RGS = var.rgs-name
        ADAPTER_RGS_KEY = random_password.rgs_key.result
        SUPPORT_EMAIL = var.support-email
        FUTURE_ANTHEM_API_URL = var.future-anthem.api-url
        FUTURE_ANTHEM_API_KEY = var.future-anthem.api-key
        FUTURE_ANTHEM_EVENT_PREFIX = var.future-anthem.event-prefix
        ANONYMISE_IPS = var.anonymise-ips
      }, lookup(var.env-vars, "adapter", {}))
    }, lookup(var.service-overrides, "adapter", {}))
    "adapter-graphql" : merge({
      enabled = lookup(var.versions, "adapter", false)
      image = "${var.container-registry}/${var.container-registry-repository}/adapter:${lookup(var.versions, "adapter", "")}"
      requests = { cpu = "400m", memory = "256Mi" }
      limits = { cpu = "600m", memory = "1024Mi" }
      metrics_enabled = true
      timeout = 60 * 3
      env-vars = merge({
        DEFAULT_RGS = var.rgs-name
        ADAPTER_RGS_KEY = random_password.rgs_key.result
        SUPPORT_EMAIL = var.support-email
        GRAPHQL_ENDPOINTS = "http://rgs/graphql${contains(keys(var.versions), "promo") ? ",http://promo/graphql" : ""}${contains(keys(var.versions), "rng") ? ",http://rng/graphql" : ""}"
        ANONYMISE_IPS = var.anonymise-ips
      }, lookup(var.env-vars, "adapter-graphql", {}))
    }, lookup(var.service-overrides, "adapter-graphql", {}))
    "promo" : merge({
      enabled = lookup(var.versions, "promo", false)
      image = "${var.container-registry}/${var.container-registry-repository}/promo:${lookup(var.versions, "promo", "")}"
      requests = { cpu = "500m", memory = "256Mi" },
      limits = { memory = "512Mi" },
      metrics_enabled = true
      env-vars = merge({
        ADAPTER_RGS_KEY = random_password.rgs_key.result
        RGS = var.rgs-name
      }, lookup(var.env-vars, "promo", {}))
    }, lookup(var.service-overrides, "promo", {})),
    "demo-casino" : merge({
      enabled = lookup(var.versions, "demo-casino", false)
      image = "${var.container-registry}/${var.container-registry-repository}/demo-casino:${lookup(var.versions, "demo-casino", "")}"
      requests = { cpu = "300m", memory = "128Mi" }
      limits = { memory = "256Mi" }
      metrics_enabled = true
      env-vars = merge({
        SECRET_KEY = "demo-secret"
      }, lookup(var.env-vars, "demo-casino", {}))
    }, lookup(var.service-overrides, "demo-casino", {})),
    "back-office" : merge({
      enabled = lookup(var.versions, "back-office", false)
      image = "${var.container-registry}/${var.container-registry-repository}/back-office:${lookup(var.versions, "back-office", "")}"
      requests = { cpu = "50m", memory = "96Mi" }
      limits = { memory = "128Mi" }
      metrics_enabled = false
      autoscaling = false
      env-vars = merge({
        VITE_BO_API_URL = ""
        VITE_NAME = var.name
        VITE_LOGO = var.logo
        VITE_ENV = var.env
        VITE_BASE_CURRENCY = var.base-currency
        VITE_BASE_CURRENCY_DECIMALS = var.base-currency-decimals
        VITE_IS_PRODUCTION = var.is-production
        ALLOW_HTTP = var.allow-http
      }, lookup(var.env-vars, "back-office", {}))
    }, lookup(var.service-overrides, "back-office", {})),
    "rgs" : merge({
      enabled = lookup(var.versions, "rgs", false)
      image = "${var.container-registry}/${var.container-registry-repository}/rgs:${lookup(var.versions, "rgs", "")}"
      requests = { cpu = "500m", memory = "512Mi" }
      limits = { memory = "1024Mi" }
      metrics_enabled = true
      env-vars = merge({
        ADAPTER_RGS_KEY = random_password.rgs_key.result
        GAMES_SERVICES = join(",", keys(lookup(var.versions, "game-servers", lookup(var.versions, "games", {}))))
        RGS = var.rgs-name
        SUPPORT_EMAIL = var.support-email
      }, lookup(var.env-vars, "rgs", {}))
    }, lookup(var.service-overrides, "rgs", {})),
    "websocket" : merge({
      enabled = lookup(var.versions, "websocket", false)
      image = "${var.container-registry}/${var.container-registry-repository}/websocket:${lookup(var.versions, "websocket", "")}"
      requests = { cpu = "300m", memory = "256Mi" }
      limits = { memory = "512Mi" }
      metrics_enabled = true
      session-affinity = true
      timeout = 60 * 60 * 24
      env-vars = merge({
      }, lookup(var.env-vars, "websocket", {}))
    }, lookup(var.service-overrides, "websocket", {})),
    "rng" : merge({
      enabled = lookup(var.versions, "rng", false)
      image = "${var.container-registry}/${var.container-registry-repository}/rng:${lookup(var.versions, "rng", "")}"
      requests = { cpu = "300m", memory = "128Mi" }
      limits = { cpu = "300m", memory = "256Mi" }
      metrics_enabled = true
      env-vars = merge({
      }, lookup(var.env-vars, "rng", {}))
    }, lookup(var.service-overrides, "rng", {})),
  }, {
    for game, version in lookup(var.versions, "game-servers", lookup(var.versions, "games", {})) : "games-${game}" => merge({
      enabled = true
      remove-secrets = true
      image = "${var.container-registry}/${var.container-registry-repository}/games/${game}:${version}"
      requests = { cpu = "250m", memory = "256Mi" }
      limits = { memory = "512Mi" }
      metrics_enabled = false
      env-vars = merge({
      }, lookup(lookup(var.env-vars, "game-servers", lookup(var.env-vars, "games", {})), game, {}))
    }, lookup(lookup(var.service-overrides, "game-servers", lookup(var.service-overrides, "games", {})), game, {}))
  })
  services = {for k, v in local._services : k => v if lookup(v, "enabled", true) != false}


  paths = merge({
    "/*" = "rgs"
    "/game/*" = "rgs"
    "/authenticate" = "rgs"
    "/balance" = "rgs"
    "/games" = "rgs"
    "/health/*" = "rgs"
    "/version/*" = "rgs"
    "/walletMessage" = "rgs"
    "/currencyDecimals" = "rgs"
    "/currencySymbols" = "rgs"
    "/currencyExchangeRates" = "rgs"

    "/websocket/*" = "websocket"

    "/backoffice" = "back-office"
    "/backoffice/*" = "back-office"

    "/launch/*" = "adapter"
    "/wallet/*" = "adapter"
    "/rgs/*" = "adapter"

    "/graphql" = "adapter-graphql"

    "/campaigns" = "promo"
    "/campaigns/*" = "promo"
    "/event/*" = "promo"
    "/feed/*" = "promo"
    "/theme/*" = "promo"

    "/fairness/*" = "rng"
  }, var.path-overrides)
}

data "google_client_config" "default" {}

provider "kubernetes" {
  host = "https://${google_container_cluster.cluster.endpoint}"
  token = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.cluster.master_auth[0].cluster_ca_certificate)
}

resource "kubernetes_namespace" "app-namespace" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_config_map" "config" {
  metadata {
    name = "config"
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
  }
  data = {
    ENV = var.env
    NODE_ENV = "production"
    NAME = var.name
    IS_PRODUCTION = var.is-production ? "true" : "false"
    PORT = "8080"
    DB_HOST = google_sql_database_instance.instance.private_ip_address
    DB_DATABASE = google_sql_database.database.name
    DB_PORT = "5432"
    REPLICA_DB_HOST = var.database-replication ? google_sql_database_instance.instance_replica[0].private_ip_address : google_sql_database_instance.instance.private_ip_address
    REPLICA_DB_PORT = "5432"
    URL = "https://${var.env}.${local.domains[0]}"
    LOG = "gcp"
    LOG_LEVEL = "info"
    MAIL_HOST = var.mail_host
    MAIL_PORT = var.mail_port
    SLACK_WEBHOOK = var.slack-webhook
    MAX_QUERY_COST = 500000
    BASE_CURRENCY = var.base-currency
    BASE_CURRENCY_DECIMALS = var.base-currency-decimals
    DAYS_TO_ARCHIVE = var.days-to-archive
    CORS_ORIGIN = var.cors-origin == null ? "https://cdn-${var.env}.${local.domains[0]}" : var.cors-origin
    ALLOW_HTTP = var.allow-http
  }
}

resource "kubernetes_secret" "secret" {
  metadata {
    name = "secret"
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
  }
  type = "Opaque"
  data = {
    DB_USERNAME = google_sql_user.users.name
    DB_PASSWORD = google_sql_user.users.password
    JWT_SECRET = random_password.jwt.result
    REDIS_HOST = google_redis_instance.redis[0].host
    REDIS_PORT = google_redis_instance.redis[0].port
    REDIS_DATABASE = var.redis-database
  }
}

resource "kubernetes_secret" "mail-secret" {
  metadata {
    name = "mail-secret"
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
  }
  type = "Opaque"
  data = {
    MAIL_USER = var.mail_user
    MAIL_PASSWORD = var.mail_password
  }
}

resource "kubernetes_secret" "secret-registry" {
  metadata {
    name = "container-registry"
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
  }
  type = "kubernetes.io/dockerconfigjson"
  data = {
    ".dockerconfigjson" = format("{\"auths\":{\"${var.container-registry}\":{\"username\":\"${var.container-registry-user}\",\"password\":\"%s\",\"auth\":\"%s\"}}}", var.container-registry-password, base64encode("${var.container-registry-user}:${var.container-registry-password}"))
  }
}


resource "kubernetes_deployment" "deployment" {
  for_each = local.services
  lifecycle {
    ignore_changes = [
      metadata[0].annotations,
      spec[0].template[0].spec[0].container[0].security_context,
      spec[0].template[0].spec[0].security_context,
      spec[0].template[0].spec[0].toleration,
      spec[0].template[0].metadata[0].annotations["kubectl.kubernetes.io/restartedAt"]
    ]
  }
  depends_on = [kubernetes_secret.secret, kubernetes_secret.mail-secret]
  metadata {
    name = each.key
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
    labels = {
      name = each.key
      metrics_target = tostring(each.value.metrics_enabled)
    }
  }
  spec {
    selector {
      match_labels = {
        name = each.key
      }
    }
    strategy {
      rolling_update {
        max_unavailable = 0
      }
    }
    template {
      metadata {
        labels = {
          name = each.key
          metrics_target = tostring(each.value.metrics_enabled)
        }
      }
      spec {
        termination_grace_period_seconds = 30
        container {
          name = each.key
          image = each.value["image"]
          readiness_probe {
            http_get {
              path = "/health"
              port = "8080"
            }
            initial_delay_seconds = 10
            failure_threshold = 2
            period_seconds = 2
            timeout_seconds = 2
          }
          liveness_probe {
            http_get {
              path = "/health"
              port = "8080"
            }
            initial_delay_seconds = 10
            failure_threshold = 6 * 5
            period_seconds = 10
            timeout_seconds = 5
          }
          port {
            name = "container-port"
            container_port = 8080
          }
          resources {
            requests = can(each.value["requests"]) ? each.value["requests"] : {}
            limits = can(each.value["limits"]) ? each.value["limits"] : {}
          }
          dynamic env_from {
            for_each = lookup(each.value, "remove-secrets", false) ? ["mail-secret"] : ["secret", "mail-secret"]
            iterator = name
            content {
              secret_ref {
                name = name.value
              }
            }
          }
          env_from {
            config_map_ref {
              name = "config"
            }
          }
          dynamic env {
            for_each = each.value["env-vars"]
            content {
              name = env.key
              value = env.value
            }
          }
        }
        image_pull_secrets {
          name = "container-registry"
        }
      }
    }
  }
}

resource "kubernetes_service" "service" {
  for_each = local.services
  lifecycle {
    ignore_changes = [metadata[0].annotations["cloud.google.com/neg"], metadata[0].annotations["cloud.google.com/neg-status"]]
  }
  metadata {
    name = each.key
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
    annotations = {
      "beta.cloud.google.com/backend-config" = "{\"ports\": {\"80\":\"backend-config-${each.key}\"}}"
    }
  }
  spec {
    type = "NodePort"
    selector = {
      name = each.key
    }
    port {
      protocol = "TCP"
      port = 80
      target_port = "8080"
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "hpa" {
  for_each = local.services
  metadata {
    name = each.key
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
  }
  spec {
    min_replicas = lookup(each.value, "autoscaling", true) ? var.cluster-min-pods : 1
    max_replicas = lookup(each.value, "autoscaling", true) ? var.cluster-max-pods : 1
    scale_target_ref {
      api_version = "apps/v1"
      kind = "Deployment"
      name = each.key
    }
    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type = "Utilization"
          average_utilization = 60
        }
      }
    }
  }
}

resource "kubernetes_manifest" "backend-config" {
  for_each = local.services
  manifest = {
    apiVersion = "cloud.google.com/v1"
    kind = "BackendConfig"
    metadata = {
      name = "backend-config-${each.key}"
      namespace = kubernetes_namespace.app-namespace.metadata[0].name
    }
    spec = {
      customRequestHeaders = {
        headers = [
          "X-IP-Country: {client_region}",
          "X-IP-Region: {client_region_subdivision}"
        ]
      }
      securityPolicy = {
        name = var.security-policy-disable ? "" : join("", google_compute_security_policy.policy[*].name)
      }
      sessionAffinity = {
        affinityType = can(each.value.session-affinity) ? "GENERATED_COOKIE" : "NONE"
      }
      timeoutSec = lookup(each.value, "timeout", 45)
    }
  }
}

resource "kubernetes_ingress_v1" "ingress" {
  count = length(local.domains)
  metadata {
    name = "ingress${count.index > 0 ? count.index : ""}"
    namespace = kubernetes_namespace.app-namespace.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.global-static-ip-name" = google_compute_global_address.external[count.index].name
      "ingress.gcp.kubernetes.io/pre-shared-cert" = google_compute_managed_ssl_certificate.certificate[count.index].name
      "nginx.ingress.kubernetes.io/use-regex" = "true"
      "nginx.ingress.kubernetes.io/rewrite-target" = "/"
    }
  }
  spec {
    rule {
      host = "${var.env}.${local.domains[count.index]}"
      http {
        dynamic path {
          for_each = {for k, v in local.paths : k => v if contains(keys(local.services), v)}
          content {
            path = path.key
            backend {
              service {
                name = path.value
                port {
                  number = "80"
                }
              }
            }
          }
        }
      }
    }
  }
}

resource "null_resource" "copy_connector" {
  triggers = {
    id = "${var.container-registry}/${var.container-registry-repository}/connector:${var.versions.connector}"
  }
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command = <<PARAMETERS
      export CR_PAT=${var.container-registry-password}
      echo $CR_PAT | docker login ${var.container-registry} -u ${var.container-registry-user} --password-stdin

      mkdir temp-connector
      docker create --name temp-connector --platform linux/amd64 ${var.container-registry}/${var.container-registry-repository}/connector:${var.versions.connector} || exit 1
      docker cp temp-connector:/usr/src/slotify/connector/lib/. temp-connector/.
      docker rm temp-connector

      gsutil -m -h "Cache-Control: max-age=0, no-cache" -h "Content-Type:text/javascript; charset=UTF-8" rsync -r temp-connector gs://${google_storage_bucket.cdn.name}/slotify/connector/
      rm -Rf temp-connector
    PARAMETERS
  }
}

resource "null_resource" "copy_game_clients" {
  for_each = lookup(var.versions, "game-clients", {})
  triggers = {
    id = "game-client/${each.key}:${each.value}"
  }
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command = <<PARAMETERS
      export CR_PAT=${var.container-registry-password}
      echo $CR_PAT | docker login ${var.container-registry} -u ${var.container-registry-user} --password-stdin

      docker create --name temp-game-clients ${var.container-registry}/${var.container-registry-repository}/game-clients/${each.key}:${each.value} || exit 1
      docker cp temp-game-clients:/dist temp-game-clients
      docker rm temp-game-clients

      gsutil -m rsync -r temp-game-clients gs://${google_storage_bucket.cdn.name}/games/${lookup(var.game-client-mapping, each.key, each.key)}/
      
      # set no-cache headers for *.{htm,html} files
      gsutil -m setmeta -h "Cache-Control: max-age=0, no-cache" gs://${google_storage_bucket.cdn.name}/games/${lookup(var.game-client-mapping, each.key, each.key)}/**/*.{htm,html}

      # delete extra files no longer present in temp-game-clients folder
      gsutil -m rsync -r -d temp-game-clients gs://${google_storage_bucket.cdn.name}/games/${lookup(var.game-client-mapping, each.key, each.key)}/
      
      rm -Rf temp-game-clients
    PARAMETERS
  }
}
