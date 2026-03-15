# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "api_url" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.admin.api_endpoint
}

output "api_custom_domain" {
  description = "API custom domain"
  value       = "https://api.${var.domain_name}"
}

output "meshql_url" {
  description = "Backend Lambda Function URL (meshql)"
  value       = aws_lambda_function_url.backend.function_url
}

output "telegram_webhook_url" {
  description = "Telegram webhook Lambda Function URL"
  value       = aws_lambda_function_url.telegram.function_url
}

output "stripe_webhook_url" {
  description = "Stripe webhook Lambda Function URL"
  value       = aws_lambda_function_url.stripe.function_url
}

output "paypal_webhook_url" {
  description = "PayPal webhook Lambda Function URL"
  value       = aws_lambda_function_url.paypal.function_url
}

output "web_bucket_name" {
  description = "S3 bucket name for web app"
  value       = aws_s3_bucket.web.id
}

output "web_distribution_id" {
  description = "CloudFront distribution ID for web"
  value       = aws_cloudfront_distribution.web.id
}

output "consumer_bucket_name" {
  description = "S3 bucket name for consumer app"
  value       = aws_s3_bucket.consumer.id
}

output "consumer_distribution_id" {
  description = "CloudFront distribution ID for consumer"
  value       = aws_cloudfront_distribution.consumer.id
}

output "creator_bucket_name" {
  description = "S3 bucket name for creator app"
  value       = aws_s3_bucket.creator.id
}

output "creator_distribution_id" {
  description = "CloudFront distribution ID for creator"
  value       = aws_cloudfront_distribution.creator.id
}

output "admin_bucket_name" {
  description = "S3 bucket name for admin app"
  value       = aws_s3_bucket.admin.id
}

output "admin_distribution_id" {
  description = "CloudFront distribution ID for admin"
  value       = aws_cloudfront_distribution.admin.id
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID (pass-through)"
  value       = var.cognito_user_pool_id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.web.id
}
