# -----------------------------------------------------------------------------
# HTTP API (API Gateway v2) — Admin API with JWT authorizer
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "admin" {
  name          = "DaleAdminApi"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "https://dalegram.com",
      "http://localhost:5173",
    ]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# JWT Authorizer (Cognito)
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.admin.id
  authorizer_type  = "JWT"
  name             = "cognito-jwt"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# -----------------------------------------------------------------------------
# Lambda Integration
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_integration" "admin" {
  api_id                 = aws_apigatewayv2_api.admin.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.admin.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# -----------------------------------------------------------------------------
# Routes — explicit methods (not ANY, to avoid catching OPTIONS preflight)
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_route" "get" {
  api_id             = aws_apigatewayv2_api.admin.id
  route_key          = "GET /{proxy+}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.admin.id}"
}

resource "aws_apigatewayv2_route" "post" {
  api_id             = aws_apigatewayv2_api.admin.id
  route_key          = "POST /{proxy+}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.admin.id}"
}

resource "aws_apigatewayv2_route" "put" {
  api_id             = aws_apigatewayv2_api.admin.id
  route_key          = "PUT /{proxy+}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.admin.id}"
}

resource "aws_apigatewayv2_route" "delete" {
  api_id             = aws_apigatewayv2_api.admin.id
  route_key          = "DELETE /{proxy+}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.admin.id}"
}

# -----------------------------------------------------------------------------
# Stage (auto-deploy)
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.admin.id
  name        = "$default"
  auto_deploy = true

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Custom Domain — api.dalegram.com
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = data.aws_acm_certificate.main.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.admin.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.default.id
}
