locals {
  dashboard = {
    displayName = "Main"
    gridLayout = {
      columns = "2"
      widgets = [
        {
          title = "Finished transactions"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate     = "$${metric.labels.wallet} ($${metric.labels.env})"
                minAlignmentPeriod = "60s"
                plotType           = "STACKED_AREA"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_RATE"
                      crossSeriesReducer : "REDUCE_SUM",
                      groupByFields = [
                        "metric.label.\"env\"",
                        "metric.label.\"wallet\""
                      ]
                    }
                    filter = "metric.type=\"prometheus.googleapis.com/finished_transactions_total/counter\""
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
          title = "Failed transactions"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate     = "$${metric.labels.code} - $${metric.labels.wallet} ($${metric.labels.env})"
                minAlignmentPeriod = "60s"
                plotType           = "STACKED_AREA"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    aggregation = {
                      alignmentPeriod    = "60s"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields = [
                        "metric.label.\"env\"",
                        "metric.label.\"code\"",
                        "metric.label.\"wallet\""
                      ]
                      perSeriesAligner = "ALIGN_RATE"
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
          title = "Response times"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate     = "$${metric.labels.route}"
                minAlignmentPeriod = "60s"
                plotType           = "LINE"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"prometheus.googleapis.com/http_request_duration_seconds/histogram\" metric.label.\"route\"!=\"/graphql\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_DELTA"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.\"route\"", "metric.label.\"isInternal\""]
                    }
                    secondaryAggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_PERCENTILE_50"
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
          title = "Wallet response times"
          xyChart = {
            chartOptions = {
              mode = "COLOR",
            }
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter : "metric.type=\"prometheus.googleapis.com/transaction_duration_milliseconds/histogram\"",
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_DELTA",
                      crossSeriesReducer = "REDUCE_PERCENTILE_50",
                      groupByFields = [
                        "metric.label.\"env\"",
                        "metric.label.\"wallet\""
                      ],
                    }
                  }
                },
                plotType           = "LINE",
                targetAxis         = "Y1",
                minAlignmentPeriod = "60s",
                legendTemplate : "$${metric.labels.wallet} ($${metric.labels.env})"
              }
            ],
            "yAxis" : {
              "scale" : "LINEAR",
              "label" : "y1Axis"
            },
            "timeshiftDuration" : "0s"
          }
        },
        {
          title = "Exceptions"
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [
              {
                legendTemplate     = "$${metric.labels.code} ($${metric.labels.env})"
                minAlignmentPeriod = "60s"
                plotType           = "STACKED_BAR"
                targetAxis         = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"prometheus.googleapis.com/exceptions_total/counter\" metric.label.\"message\"!=monitoring.regex.full_match(\"Service returned error\") metric.label.\"message\"!=monitoring.regex.full_match(\"Wallet returned error\")"
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_RATE"
                      crossSeriesReducer : "REDUCE_SUM",
                      groupByFields = [
                        "metric.label.\"env\"",
                        "metric.label.\"code\"",
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
        }
      ]
    }
  }
}

resource "google_monitoring_dashboard" "dashboard" {
  dashboard_json = jsonencode(local.dashboard)
}
