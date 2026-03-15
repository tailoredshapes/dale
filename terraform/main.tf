terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket       = "dale-tailoredshapes-terraform-state"
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
}

# CloudFront requires ACM certs in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

provider "mongodbatlas" {
  public_key  = var.atlas_client_id
  private_key = var.atlas_client_secret
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
