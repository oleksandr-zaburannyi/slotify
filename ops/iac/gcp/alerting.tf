resource "google_monitoring_notification_channel" "sms-notification" {
  count = length(var.sms-alerts)
  display_name = var.sms-alerts[count.index]
  type = "sms"
  labels = {
    number = var.sms-alerts[count.index]
  }
}

resource "google_monitoring_notification_channel" "email-notification" {
  display_name = "support email"
  type = "email"
  labels = {
    email_address = var.support-email
  }
}

resource "google_monitoring_notification_channel" "slack-notification" {
  count = var.slack-alert-token != "" ? 1 : 0
  display_name = "GCP Slack Alerts"
  type = "slack"
  enabled = var.slack-alert-token != ""
  labels = {
    channel_name = var.slack-alert-channel
    team = var.slack-alert-workspace
  }
  sensitive_labels {
    auth_token = var.slack-alert-token
  }
}

resource "google_monitoring_uptime_check_config" "uptime_check" {
  display_name = "uptime-check"
  period = "60s"
  timeout = "10s"
  http_check {
    path = "/health/all"
    port = 443
    use_ssl = true
    request_method = "GET"
    validate_ssl = true
  }
  content_matchers {
    matcher = "NOT_CONTAINS_STRING"
    content = "OFFLINE"
  }
  monitored_resource {
    labels = {
      project_id = var.project
      host = "${var.env}.${local.domains[0]}"
    }
    type = "uptime_url"
  }
}

resource "google_monitoring_alert_policy" "uptime_alert_policy" {
  display_name = "Uptime alert policy"
  combiner = "OR"

  notification_channels = concat(
    google_monitoring_notification_channel.sms-notification[*].id,
    [google_monitoring_notification_channel.email-notification.id],
    var.slack-alert-token != "" ? [google_monitoring_notification_channel.slack-notification[0].id] : []
  )
  conditions {
    display_name = "uptime check"

    condition_threshold {
      filter = format("metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.\"check_id\"=\"%s\" AND resource.type=\"uptime_url\"", google_monitoring_uptime_check_config.uptime_check.uptime_check_id)
      duration = "300s"
      comparison = "COMPARISON_LT"
      threshold_value = 1
      aggregations {
        alignment_period = "60s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MIN"
        group_by_fields = []
      }
      trigger {
        count = 1
      }
    }
  }
  depends_on = [
    google_monitoring_notification_channel.sms-notification,
    google_monitoring_notification_channel.email-notification,
  ]

}


resource "google_monitoring_alert_policy" "database_cpu_policy" {
  display_name = "Primary DB CPU policy"
  combiner = "OR"

  notification_channels = concat(
    google_monitoring_notification_channel.sms-notification[*].id,
    [google_monitoring_notification_channel.email-notification.id],
    var.slack-alert-token != "" ? [google_monitoring_notification_channel.slack-notification[0].id] : []
  )
  conditions {
    display_name = "primary DB CPU policy"

    condition_threshold {
      filter = format("metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\" AND resource.labels.database_id=\"%s:%s\" AND resource.type=\"cloudsql_database\"", var.project, google_sql_database_instance.instance.name)
      duration = "300s"
      comparison = "COMPARISON_GT"
      threshold_value = 0.80
      aggregations {
        alignment_period = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
      trigger {
        count = 1
      }
    }
  }
  depends_on = [
    google_monitoring_notification_channel.sms-notification,
    google_monitoring_notification_channel.email-notification,
    google_monitoring_notification_channel.slack-notification
  ]

}
