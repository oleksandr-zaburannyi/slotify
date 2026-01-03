variable "top-project" {
  type = string
  description = "Top GCP project"
}

variable "dns-zone" {
  type = string
  default = ""
  description = "Domain DNS zone"
}

variable "dns-zones" {
  type = list(string)
  default = []
  description = "Extra domains DNS zones"
}

variable "name" {
  type = string
  description = "Company name"
}
variable "rgs-name" {
  type = string
  description = "RGS name"
}

variable "logo" {
  type = string
  description = "Company logo url"
}

variable "domain" {
  type = string
  default = ""
  description = "Domain"
}

variable "domains" {
  type = list(string)
  default = []
  description = "Extra domain"
}

variable "container-registry" {
  type = string
}

variable "container-registry-user" {
  type = string
}

variable "container-registry-password" {
  type = string
}

variable "base-currency" {
  type = string
  default = "eur"
}

variable "base-currency-decimals" {
  type = number
  default = 2
}

variable "project" {
  type = string
  description = "GCP project"
}

variable "cdn-bucket" {
  type = string
  default = ""
}

variable "region" {
  type = string
  description = "GCP region"
}

variable "zone" {
  type = string
  description = "GCP zone"
}

variable "rate-limiting" {
  type = bool
  description = "Rate limiting enabled"
  default = true
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
  description = "Rate limiting configuration (number of requests per timeframe in seconds"
}

variable "cluster-autopilot" {
  type = bool
  description = "Cluster autopilot"
  default = false
}

variable "cluster-initial-node-count" {
  type = number
  default = 1
}

variable "bucket-location" {
  type = string
  description = "`ASIA` or `EU`"
}

variable "is-production" {
  type = bool
  description = "Disables cheats, verbose error responses and wallets verifier"
  default = true
}

variable "env" {
  type = string
  description = "Name of the environment"
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
}

variable "enable-prometheus-monitoring" {
  type    = bool
  default = true
}

variable "prometheus-scrape-interval" {
  type = number
  default = 60
}

variable "game-client-mapping" {
  type    = any
  default = {}
}

variable "env-vars" {
  type = any
  default = {}
}

variable "database-tier" {
  type = string
  description = "See for details: https://cloud.google.com/sql/docs/mysql/instance-settings"
}

variable "database-version" {
  type = string
  default = "POSTGRES_16"
}

variable "database-edition" {
  type = string
  default = "ENTERPRISE"
}

variable "database-replica-tier" {
  type = string
}

variable "database-availability" {
  type = string
  validation {
    condition = var.database-availability == "REGIONAL" || var.database-availability == "ZONAL"
    error_message = "Accepted values are `REGIONAL` or `ZONAL`."
  }
}

variable "database-replication" {
  type = bool
  description = "Database read replication"
}

variable "database-authorized-ips" {
  type = list(string)
  description = "Database authorised IPs"
  default = []
}

variable "cluster-availability" {
  type = string
  validation {
    condition = var.cluster-availability == "REGIONAL" || var.cluster-availability == "ZONAL"
    error_message = "Accepted values are `REGIONAL` or `ZONAL`."
  }
}

variable "spot_instances" {
  type = bool
  default = false
}

variable "redis-enabled" {
  type = bool
  default = true
}

variable "redis-high-availability" {
  type = bool
  default = false
}

variable "redis-memory-size" {
  type = number
  default = 1
}

variable "redis-database" {
  type = number
  default = 0
}

variable "security-policy-disable" {
  type = bool
  default = false
}

variable "ip-blocked-countries" {
  type = list(string)
  default = ["KP", "SO", "AF", "IR", "SY"] #https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
}

variable "api-blocked-countries" {
  type = list(string)
  default = []
}

variable "geoip-blocked-states" {
  type = list(string)
  default = []
}

variable "ipgeolocation-api-key" {
  type = string
  default = ""
}

variable "support-email" {
  type = string
}

variable "mail_host" {
  type = string
}

variable "mail_port" {
  type = number
  default = 465
}

variable "mail_user" {
  type = string
}

variable "mail_password" {
  type = string
}

variable "namespace" {
  type = string
  default = "app"
}

variable "cors-origin" {
  type = string
  default = null
}

variable "cluster-machine-type" {
  default = "n2-highcpu-4"
}

variable "cluster-disk-size" {
  description = "disk size of node in GB"
  default = 20
}

variable "cluster-min-nodes" {
  default = 1
}

variable "cluster-min-pods" {
  default = 2
}

variable "cluster-max-pods" {
  default = 500
}

variable "cluster-node-pools" {
  default = 1
}

variable "cluster-max-nodes" {
  default = 50
}

variable "days-to-archive" {
  description = "number of days after which data is copied to archive tables"
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
}

variable "sms-alerts" {
  description = "List of phone numbers for alerting. Numbers need to be manually verified at https://console.cloud.google.com/monitoring/alerting/notifications"
  type = list(string)
  default = []
}

variable "slack-webhook" {
  description = "Webhook URLs for your Slack workspace"
  type = string
  default = ""
}

variable "slack-alert-channel" {
  description = "Slack channel for alerts"
  type = string
  default = ""
}

variable "slack-alert-workspace" {
  description = "Slack workspace for alerts"
  type = string
  default = ""
}

variable "slack-alert-token" {
  description = "Slack token for alerts"
  type = string
  default = ""
}

variable "allow-http" {
  type = bool
  default = false
}

variable "anonymise-ips" {
  type = bool
  default = false
}

locals {
  domains = [for i, item in concat([var.domain], var.domains) : item if item != ""]
}

locals {
  dns-zones = [for i, item in concat([var.dns-zone], var.dns-zones) : item if item != ""]
}