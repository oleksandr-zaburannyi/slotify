locals {
  dashboard = {
    displayName = "Main"
    gridLayout = {
      columns = "2"
      widgets = [
        {
          title   = "Finished transactions"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                minAlignmentPeriod = "60s"
                plotType           = "STACKED_AREA"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    aggregation = {
                      alignmentPeriod   = "60s"
                      perSeriesAligner  = "ALIGN_RATE"
                    }
                    filter = "metric.type=\"prometheus.googleapis.com/finished_transactions_total/counter\""
                    secondaryAggregation = {
                      alignmentPeriod   = "60s"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields = [
                        "metric.label.\"env\"",
                        "metric.label.\"brand\"",
                        "metric.label.\"game\"",
                        "metric.label.\"operator\"",
                        "metric.label.\"wallet\""
                      ]
                    }
                  }
                }
              }
            ]
            timeshiftDuration = "0s"
            yAxis = {
              label = "y1Axis"
              scale = "LINEAR"
            }
          }
        },
        {
          title   = "Failed transactions"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate    = "$${metric.labels.reason} ($${metric.labels.code}$${metric.labels.error}) / $${metric.labels.wallet}, $${metric.labels.env}"
                minAlignmentPeriod = "60s"
                plotType           = "STACKED_AREA"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    aggregation = {
                      alignmentPeriod   = "60s"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields = [
                        "metric.label.\"env\"",
                        "metric.label.\"reason\"",
                        "metric.label.\"code\"",
                        "metric.label.\"error\"",
                        "metric.label.\"wallet\""
                      ]
                      perSeriesAligner = "ALIGN_DELTA"
                    }
                    filter = "metric.type=\"prometheus.googleapis.com/failed_transactions_total/counter\""
                  }
                }
              }
            ]
            timeshiftDuration = "0s"
            yAxis = {
              label = "y1Axis"
              scale = "LINEAR"
            }
          }
        },
        {
          title   = "Response times"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate    = "$${metric.labels.route}"
                minAlignmentPeriod = "60s"
                plotType           = "LINE"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"prometheus.googleapis.com/http_request_duration_seconds/histogram\" metric.label.\"userAgent\"!=monitoring.regex.full_match(\"node-fetch.+\") metric.label.\"route\"!=\"/graphql\""
                    aggregation = {
                      alignmentPeriod   = "60s"
                      perSeriesAligner  = "ALIGN_DELTA"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields = ["metric.label.\"route\""]
                    }
                    secondaryAggregation = {
                      alignmentPeriod   = "60s"
                      perSeriesAligner  = "ALIGN_PERCENTILE_50"
                    }
                  }
                }
              }
            ]
            timeshiftDuration = "0s"
            yAxis = {
              label = "y1Axis"
              scale = "LINEAR"
            }
          }
        },
        {
          title   = "Wallet response times"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate    = "$${metric.labels.wallet}/$${metric.labels.operator}/$${metric.labels.env}"
                minAlignmentPeriod = "60s"
                plotType           = "LINE"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"prometheus.googleapis.com/transaction_duration_milliseconds/histogram\""
                    aggregation = {
                      alignmentPeriod   = "60s"
                      perSeriesAligner  = "ALIGN_DELTA"
                      groupByFields = [
                        "metric.label.\"env\"",
                        "metric.label.\"brand\"",
                        "metric.label.\"game\"",
                        "metric.label.\"operator\"",
                        "metric.label.\"wallet\""
                      ]
                    }
                    secondaryAggregation = {
                      alignmentPeriod   = "60s"
                      perSeriesAligner  = "ALIGN_PERCENTILE_50"
                    }
                  }
                }
              }
            ]
            timeshiftDuration = "0s"
            yAxis = {
              label = "y1Axis"
              scale = "LINEAR"
            }
          }
        },
        {
          title   = "Exceptions"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate    = "$${metric.labels.code} ($${metric.labels.env})"
                minAlignmentPeriod = "60s"
                plotType           = "STACKED_BAR"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"prometheus.googleapis.com/exceptions_total/counter\" metric.label.\"message\"!=monitoring.regex.full_match(\"Service returned error\") metric.label.\"message\"!=monitoring.regex.full_match(\"Wallet returned error\")"
                    aggregation = {
                      alignmentPeriod   = "60s"
                      perSeriesAligner  = "ALIGN_DELTA"
                    }
                  }
                }
              }
            ]
            timeshiftDuration = "0s"
            yAxis = {
              label = "y1Axis"
              scale = "LINEAR"
            }
          }
        }
      ]
    }
  }
}

resource "google_monitoring_dashboard" "dashboard" {
  dashboard_json = jsonencode(local.dashboard)
}
