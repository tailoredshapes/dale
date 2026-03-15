# -----------------------------------------------------------------------------
# Cognito — Reference existing pool (preserved from CDK, not recreated)
# -----------------------------------------------------------------------------

data "aws_cognito_user_pools" "dale" {
  name = "dale-creators-prod"
}

locals {
  cognito_pool_arn = "arn:aws:cognito-idp:${var.aws_region}:${data.aws_caller_identity.current.account_id}:userpool/${var.cognito_user_pool_id}"
}
