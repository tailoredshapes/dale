# -----------------------------------------------------------------------------
# Cognito — Reference existing pool (preserved from CDK, not recreated)
# -----------------------------------------------------------------------------

data "aws_cognito_user_pools" "dale" {
  name = "dale-creators-prod"
}

locals {
  cognito_pool_arn = "arn:aws:cognito-idp:${var.aws_region}:${data.aws_caller_identity.current.account_id}:userpool/${var.cognito_user_pool_id}"
}

# -----------------------------------------------------------------------------
# Cognito User Pool Client (CDK client was deleted with the stack)
# -----------------------------------------------------------------------------

resource "aws_cognito_user_pool_client" "web" {
  name         = "web-client"
  user_pool_id = var.cognito_user_pool_id

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  supported_identity_providers = ["COGNITO"]
}
