# -----------------------------------------------------------------------------
# Secrets Manager — MongoDB URI
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "mongodb_uri" {
  name = "dale/mongodb-uri"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "mongodb_uri" {
  secret_id     = aws_secretsmanager_secret.mongodb_uri.id
  secret_string = local.mongodb_uri
}
