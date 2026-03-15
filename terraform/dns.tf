# -----------------------------------------------------------------------------
# ACM Certificate (data source — existing cert in us-east-1)
# -----------------------------------------------------------------------------

data "aws_acm_certificate" "main" {
  provider = aws.us_east_1

  domain      = var.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}

# -----------------------------------------------------------------------------
# Cloudflare DNS Records
# -----------------------------------------------------------------------------

# dalegram.com → CloudFront web distribution (CNAME flattening handles apex)
resource "cloudflare_record" "web" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain_name
  content = aws_cloudfront_distribution.web.domain_name
  type    = "CNAME"
  proxied = false
  ttl     = 300
}

# api.dalegram.com → API Gateway custom domain
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
  type    = "CNAME"
  proxied = false
  ttl     = 300
}
