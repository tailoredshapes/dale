#!/bin/bash
set -e

# Generate runtime config.js for Dale Frontend Apps
# Usage: ./scripts/generate-config.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Get CDK outputs
get_output() {
    local key=$1
    aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME:-Dale-dev}" \
        --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

API_URL=$(get_output "AdminApiUrl")
USER_POOL_ID=$(get_output "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")
COGNITO_DOMAIN=$(get_output "CognitoDomain")
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -z "$API_URL" ]; then
    echo "Error: Could not get stack outputs. Have you deployed the CDK stack?"
    exit 1
fi

COGNITO_FULL_DOMAIN="${COGNITO_DOMAIN}.auth.${AWS_REGION}.amazoncognito.com"

# Generate consumer config
CONSUMER_URL=$(get_output "ConsumerSiteUrl")
cat > "$ROOT_DIR/web/consumer/public/config.js" << EOF
window.DALE_CONFIG = {
  apiUrl: '${API_URL}',
  cognitoDomain: '${COGNITO_FULL_DOMAIN}',
  cognitoClientId: '${USER_POOL_CLIENT_ID}',
  redirectUri: '${CONSUMER_URL}/auth',
};
EOF
echo "Generated consumer config"

# Generate creator config
CREATOR_URL=$(get_output "CreatorSiteUrl")
cat > "$ROOT_DIR/web/creator/public/config.js" << EOF
window.DALE_CONFIG = {
  apiUrl: '${API_URL}',
  cognitoDomain: '${COGNITO_FULL_DOMAIN}',
  cognitoClientId: '${USER_POOL_CLIENT_ID}',
  redirectUri: '${CREATOR_URL}/auth',
};
EOF
echo "Generated creator config"

# Generate admin config
ADMIN_URL=$(get_output "AdminSiteUrl")
cat > "$ROOT_DIR/web/admin/public/config.js" << EOF
window.DALE_CONFIG = {
  apiUrl: '${API_URL}',
  cognitoDomain: '${COGNITO_FULL_DOMAIN}',
  cognitoClientId: '${USER_POOL_CLIENT_ID}',
  redirectUri: '${ADMIN_URL}/auth',
};
EOF
echo "Generated admin config"

echo "All configs generated successfully!"
