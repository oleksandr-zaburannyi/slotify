terraform {
  required_version = ">= 1.4.5"

  required_providers {
    google = {
      version = "~> 6.8"
    }
    google-beta = {
      version = "~> 6.8"
    }
    kubernetes = {
      version = "~> 2.33"
    }
    random = {
      version = "~> 3.6"
    }
    null = {
      version = "~> 3.2"
    }
  }
}
