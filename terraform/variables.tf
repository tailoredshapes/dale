variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "stage" {
  description = "Deployment stage (dev or prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "prod"], var.stage)
    error_message = "Stage must be either 'dev' or 'prod'."
  }
}

variable "cognito_user_pool_id" {
  description = "Existing Cognito User Pool ID"
  type        = string
  default     = "us-east-1_a7plDpMno"
}

variable "cognito_client_id" {
  description = "Existing Cognito User Pool Client ID"
  type        = string
  default     = "4l5l3o8hro5autenfr8ss1mn3a"
}

variable "atlas_project_id" {
  description = "MongoDB Atlas project ID"
  type        = string
  default     = "69b60818c4658b59ee898165"
}

variable "atlas_client_id" {
  description = "MongoDB Atlas service account client ID"
  type        = string
  sensitive   = true
}

variable "atlas_client_secret" {
  description = "MongoDB Atlas service account client secret"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for dalegram.com"
  type        = string
  default     = "9ba58c35f97943631f62aa5a732ba96f"
}

variable "google_client_id" {
  description = "Google OAuth client ID (empty = disabled)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret (empty = disabled)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "dalegram.com"
}

variable "callback_urls" {
  description = "Cognito callback URLs"
  type        = list(string)
  default     = ["https://dalegram.com/callback"]
}

variable "logout_urls" {
  description = "Cognito logout URLs"
  type        = list(string)
  default     = ["https://dalegram.com/"]
}

locals {
  mongodb_uri = "mongodb+srv://tailoredshapes-app:fE8h63i1KDuz0D0ScKeIN4c4GcxoP6Mx@tailoredshapes-dev.xupwrzt.mongodb.net/dale"

  common_tags = {
    Project     = "dale"
    Environment = var.stage
    ManagedBy   = "terraform"
  }
}
