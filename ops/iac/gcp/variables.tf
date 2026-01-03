variable "top-project" {
  type = string
  description = "Top GCP project."
}

variable "dns-zone" {
  type = string
  default = ""
  description = "Domain DNS zone."
}

variable "dns-zones" {
  type = list(string)
  default = []
  description = "Extra domains DNS zones."
}

variable "name" {
  type = string
  description = "Company name."
}
variable "rgs-name" {
  type = string
  description = "RGS name."
}

variable "logo" {
  type = string
  description = "Company logo url."
}

variable "domain" {
  type = string
  default = ""
  description = "Domain."
}

variable "domains" {
  type = list(string)
  default = []
  description = "Extra domain."
}

variable "container-registry" {
  type = string
  description = "Fully qualified container registry host (e.g. gcr.io/project)."
}

variable "container-registry-repository" {
  type    = string
  default = "slotify"
  description = "Repository segment appended to the container registry, e.g. gcr.io/project/<repo>."
}

variable "container-registry-user" {
  type = string
  description = "Username used to authenticate against the container registry."
}

variable "container-registry-password" {
  type = string
  description = "Password or token used to authenticate against the container registry."
}

variable "base-currency" {
  type = string
  default = "eur"
  description = "Default ISO currency code used by Slotify."
}

variable "base-currency-decimals" {
  type = number
  default = 2
  description = "Number of decimal places used for the base currency."
}

variable "project" {
  type = string
  description = "GCP project."
}

variable "cdn-bucket" {
  type = string
  default = ""
  description = "GCS bucket that serves static assets via the CDN."
}

variable "region" {
  type = string
  description = "GCP region."
}

variable "zone" {
  type = string
  description = "GCP zone."
}

variable "rate-limiting" {
  type = bool
  description = "Rate limiting enabled."
  default = true
}

variable "rate-limiting-excluded-ips" {
  type = set(string)
  description = "List of IPs excluded from rate limiting"
  default = []
}

variable "rate-limiting-config" {
  type = object({
    requests = number
    seconds = number
  })
  default = {
    requests = 200
    seconds = 60
  }
  description = "Rate limiting configuration (number of requests per timeframe in seconds)."
}

variable "cluster-autopilot" {
  type = bool
  description = "Cluster autopilot."
  default = false
}

variable "cluster-initial-node-count" {
  type = number
  default = 1
  description = "Initial node count for standard (non-autopilot) clusters."
}

variable "bucket-location" {
  type = string
  description = "`ASIA` or `EU`."
}

variable "is-production" {
  type = bool
  description = "Disables cheats, verbose error responses and wallets verifier."
  default = true
}

variable "env" {
  type = string
  description = "Name of the environment."
}

variable "versions" {
  type = any
  default = {
    "adapter" = ""
    "back-office" = ""
    "rgs" = ""
    "rng" = ""
    "connector" = ""
    "demo-casino" = ""
    "promo" = ""
    "games" = {}
  }
  description = "Map of container image tags per service."
}

variable "enable-prometheus-monitoring" {
  type    = bool
  default = true
  description = "Whether to deploy Prometheus monitoring resources."
}

variable "prometheus-scrape-interval" {
  type = number
  default = 60
  description = "Prometheus scrape interval in seconds."
}

variable "game-client-mapping" {
  type    = any
  default = {}
  description = "Mapping from game client IDs to storage folder names."
}

variable "env-vars" {
  type = any
  default = {}
  description = "Additional environment variables merged into each service."
}

variable "service-overrides" {
  type = any
  default = {}
  description = "Per-service configuration overrides (e.g. requests, limits, remove-secrets). Supports top-level service keys and nested `game-servers`/`games` maps."
}

variable "path-overrides" {
  type = map(string)
  default = {}
  description = "Ingress path overrides/additions mapping HTTP paths to service names."
}

variable "database-tier" {
  type = string
  description = "See for details: https://cloud.google.com/sql/docs/mysql/instance-settings."
}

variable "database-version" {
  type = string
  default = "POSTGRES_16"
  description = "Cloud SQL database engine version."
}

variable "database-edition" {
  type = string
  default = "ENTERPRISE"
  description = "Cloud SQL edition (e.g. ENTERPRISE)."
}

variable "database-replica-tier" {
  type = string
  description = "Machine tier for the read replica instance."
}

variable "database-availability" {
  type = string
  validation {
    condition = var.database-availability == "REGIONAL" || var.database-availability == "ZONAL"
    error_message = "Accepted values are `REGIONAL` or `ZONAL`."
  }
  description = "Whether the database is REGIONAL or ZONAL."
}

variable "database-replication" {
  type = bool
  description = "Database read replication."
}

variable "database-authorized-ips" {
  type = list(string)
  description = "Database authorised IPs."
  default = []
}

variable "cluster-availability" {
  type = string
  validation {
    condition = var.cluster-availability == "REGIONAL" || var.cluster-availability == "ZONAL"
    error_message = "Accepted values are `REGIONAL` or `ZONAL`."
  }
  description = "Whether the GKE cluster is REGIONAL or ZONAL."
}

variable "spot_instances" {
  type = bool
  default = false
  description = "Whether to use spot/preemptible nodes for the cluster."
}

variable "redis-enabled" {
  type = bool
  default = true
  description = "Whether to provision a Redis instance."
}

variable "redis-high-availability" {
  type = bool
  default = false
  description = "Whether Redis should be deployed in highly available mode."
}

variable "redis-memory-size" {
  type = number
  default = 1
  description = "Redis memory size in GiB."
}

variable "redis-database" {
  type = number
  default = 0
  description = "Redis database index."
}

variable "security-policy-disable" {
  type = bool
  default = false
  description = "Whether to disable the Cloud Armor security policy."
}

variable "support-email" {
  type = string
  description = "Support contact email address."
}

variable "mail_host" {
  type = string
  description = "SMTP host used for transactional email."
}

variable "mail_port" {
  type = number
  default = 465
  description = "SMTP port used for transactional email."
}

variable "mail_user" {
  type = string
  description = "SMTP username."
}

variable "mail_password" {
  type = string
  description = "SMTP password."
}

variable "namespace" {
  type = string
  default = "app"
  description = "Kubernetes namespace for Slotify workloads."
}

variable "cors-origin" {
  type = string
  default = null
  description = "Allowed CORS origin override (set to null to disable)."
}

variable "cluster-machine-type" {
  default = "n2-highcpu-4"
  description = "Machine type used for cluster nodes."
}

variable "cluster-disk-size" {
  description = "disk size of node in GB."
  default = 20
}

variable "cluster-min-nodes" {
  default = 1
  description = "Minimum number of nodes per node pool."
}

variable "cluster-min-pods" {
  default = 2
  description = "Minimum number of pods the cluster must support."
}

variable "cluster-max-pods" {
  default = 500
  description = "Maximum number of pods the cluster should support."
}

variable "cluster-node-pools" {
  default = 1
  description = "Number of node pools to create."
}

variable "cluster-max-nodes" {
  default = 50
  description = "Maximum number of nodes per node pool."
}

variable "days-to-archive" {
  description = "number of days after which data is copied to archive tables."
  default = 365
}

variable "future-anthem" {
  type = object({
    api-url = string
    api-key = string
    event-prefix = string
  })
  default = {
    api-url = ""
    api-key = ""
    event-prefix = ""
  }
  description = "Configuration for the Future Anthem integration."
}

variable "sms-alerts" {
  description = "List of phone numbers for alerting. Numbers need to be manually verified at https://console.cloud.google.com/monitoring/alerting/notifications."
  type = list(string)
  default = []
}

variable "slack-webhook" {
  description = "Webhook URLs for your Slack workspace."
  type = string
  default = ""
}

variable "slack-alert-channel" {
  description = "Slack channel for alerts."
  type = string
  default = ""
}

variable "slack-alert-workspace" {
  description = "Slack workspace for alerts."
  type = string
  default = ""
}

variable "slack-alert-token" {
  description = "Slack token for alerts."
  type = string
  default = ""
}

variable "allow-http" {
  type = bool
  default = false
  description = "Whether HTTP traffic is allowed (disables HTTPS-only behavior)."
}

variable "anonymise-ips" {
  type = bool
  default = false
  description = "Whether player IP addresses should be anonymised."
}

locals {
  domains = [for i, item in concat([var.domain], var.domains) : item if item != ""]
}

locals {
  dns-zones = [for i, item in concat([var.dns-zone], var.dns-zones) : item if item != ""]
}
