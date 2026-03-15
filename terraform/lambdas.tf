# -----------------------------------------------------------------------------
# IAM Roles
# -----------------------------------------------------------------------------

# Backend Lambda role (Rust — needs Secrets Manager access for MongoDB URI)
resource "aws_iam_role" "backend" {
  name = "dale-backend-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "backend_basic" {
  role       = aws_iam_role.backend.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "backend_mongodb_secret" {
  name = "mongodb-secret-access"
  role = aws_iam_role.backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      Resource = aws_secretsmanager_secret.mongodb_uri.arn
    }]
  })
}

# Telegram webhook Lambda role
resource "aws_iam_role" "telegram" {
  name = "dale-telegram-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "telegram_basic" {
  role       = aws_iam_role.telegram.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Stripe webhook Lambda role
resource "aws_iam_role" "stripe" {
  name = "dale-stripe-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "stripe_basic" {
  role       = aws_iam_role.stripe.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# PayPal webhook Lambda role
resource "aws_iam_role" "paypal" {
  name = "dale-paypal-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "paypal_basic" {
  role       = aws_iam_role.paypal.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Admin API Lambda role (needs Cognito + SES)
resource "aws_iam_role" "admin" {
  name = "dale-admin-role-${var.stage}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "admin_basic" {
  role       = aws_iam_role.admin.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "admin_cognito" {
  name = "cognito-access"
  role = aws_iam_role.admin.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:ListUsers"
      ]
      Resource = local.cognito_pool_arn
    }]
  })
}

resource "aws_iam_role_policy" "admin_ses" {
  name = "ses-send"
  role = aws_iam_role.admin.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ]
      Resource = "*"
    }]
  })
}

# -----------------------------------------------------------------------------
# Lambda Archives
# -----------------------------------------------------------------------------

data "archive_file" "backend" {
  type        = "zip"
  source_file = "${path.module}/../backend/target/lambda/dale-backend/bootstrap"
  output_path = "${path.module}/../backend/target/lambda/dale-backend.zip"
}

# Node.js lambdas are pre-bundled by scripts/bundle-lambdas.sh

# -----------------------------------------------------------------------------
# Lambda Functions
# -----------------------------------------------------------------------------

# Backend Lambda (Rust, ARM64)
resource "aws_lambda_function" "backend" {
  function_name = "dale-backend-${var.stage}"
  role          = aws_iam_role.backend.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = ["arm64"]
  memory_size   = 512
  timeout       = 30

  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256

  environment {
    variables = {
      MONGODB_URI = local.mongodb_uri
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.backend_basic,
    aws_iam_role_policy.backend_mongodb_secret,
  ]

  tags = local.common_tags
}

resource "aws_lambda_function_url" "backend" {
  function_name      = aws_lambda_function.backend.function_name
  authorization_type = "NONE"
}

# Telegram Webhook Lambda (Node.js 20, ARM64)
resource "aws_lambda_function" "telegram" {
  function_name = "dale-telegram-${var.stage}"
  role          = aws_iam_role.telegram.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 15

  filename         = "${path.module}/../dist/telegram/telegram.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/telegram/telegram.zip")

  environment {
    variables = {
      MESHQL_URL = aws_lambda_function_url.backend.function_url
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.telegram_basic,
  ]

  tags = local.common_tags
}

resource "aws_lambda_function_url" "telegram" {
  function_name      = aws_lambda_function.telegram.function_name
  authorization_type = "NONE"
}

# Stripe Webhook Lambda (Node.js 20, ARM64)
resource "aws_lambda_function" "stripe" {
  function_name = "dale-stripe-${var.stage}"
  role          = aws_iam_role.stripe.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 15

  filename         = "${path.module}/../dist/stripe/stripe.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/stripe/stripe.zip")

  environment {
    variables = {
      MESHQL_URL = aws_lambda_function_url.backend.function_url
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.stripe_basic,
  ]

  tags = local.common_tags
}

resource "aws_lambda_function_url" "stripe" {
  function_name      = aws_lambda_function.stripe.function_name
  authorization_type = "NONE"
}

# PayPal Webhook Lambda (Node.js 20, ARM64)
resource "aws_lambda_function" "paypal" {
  function_name = "dale-paypal-${var.stage}"
  role          = aws_iam_role.paypal.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 15

  filename         = "${path.module}/../dist/paypal/paypal.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/paypal/paypal.zip")

  environment {
    variables = {
      MESHQL_URL     = aws_lambda_function_url.backend.function_url
      PAYPAL_BASE_URL = "https://api-m.paypal.com"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.paypal_basic,
  ]

  tags = local.common_tags
}

resource "aws_lambda_function_url" "paypal" {
  function_name      = aws_lambda_function.paypal.function_name
  authorization_type = "NONE"
}

# Admin API Lambda (Node.js 20, ARM64)
resource "aws_lambda_function" "admin" {
  function_name = "dale-admin-${var.stage}"
  role          = aws_iam_role.admin.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 15

  filename         = "${path.module}/../dist/admin/admin.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/admin/admin.zip")

  environment {
    variables = {
      MESHQL_URL           = aws_lambda_function_url.backend.function_url
      TELEGRAM_WEBHOOK_URL = aws_lambda_function_url.telegram.function_url
      STRIPE_WEBHOOK_URL   = aws_lambda_function_url.stripe.function_url
      PAYPAL_WEBHOOK_URL   = aws_lambda_function_url.paypal.function_url
      PAYPAL_BASE_URL      = "https://api-m.paypal.com"
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.admin_basic,
    aws_iam_role_policy.admin_cognito,
    aws_iam_role_policy.admin_ses,
  ]

  tags = local.common_tags
}

resource "aws_lambda_function_url" "admin" {
  function_name      = aws_lambda_function.admin.function_name
  authorization_type = "NONE"
}

# Lambda permission for API Gateway to invoke admin Lambda
resource "aws_lambda_permission" "admin_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.admin.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.admin.execution_arn}/*/*"
}
