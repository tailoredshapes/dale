#!/bin/bash
set -e

# Deploy Dale Frontend Apps
# Usage: ./scripts/deploy-frontend.sh [consumer|creator|admin|all]

APP=${1:-all}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get CDK outputs
get_output() {
    local key=$1
    aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME:-Dale-dev}" \
        --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

build_app() {
    local app=$1
    log_info "Building $app app..."

    cd "$ROOT_DIR/web/$app"

    if [ ! -d "node_modules" ]; then
        npm ci
    fi

    npm run build

    log_info "$app app built successfully"
}

deploy_app() {
    local app=$1
    local bucket_key="${app^}BucketName"
    local dist_key="${app^}DistributionId"

    local bucket=$(get_output "$bucket_key")
    local distribution=$(get_output "$dist_key")

    if [ -z "$bucket" ]; then
        log_error "Could not find bucket for $app app. Have you deployed the CDK stack?"
        return 1
    fi

    log_info "Deploying $app app to s3://$bucket"

    aws s3 sync "$ROOT_DIR/web/$app/dist" "s3://$bucket" \
        --delete \
        --cache-control "public, max-age=31536000, immutable" \
        --exclude "index.html" \
        --exclude "config.js"

    # Deploy index.html and config.js with no-cache
    aws s3 cp "$ROOT_DIR/web/$app/dist/index.html" "s3://$bucket/index.html" \
        --cache-control "no-cache, no-store, must-revalidate"

    if [ -f "$ROOT_DIR/web/$app/dist/config.js" ]; then
        aws s3 cp "$ROOT_DIR/web/$app/dist/config.js" "s3://$bucket/config.js" \
            --cache-control "no-cache, no-store, must-revalidate"
    fi

    if [ -n "$distribution" ]; then
        log_info "Invalidating CloudFront cache for $app app..."
        aws cloudfront create-invalidation \
            --distribution-id "$distribution" \
            --paths "/*" \
            --output text > /dev/null
    fi

    log_info "$app app deployed successfully"
}

# Main
case $APP in
    consumer|creator|admin)
        build_app "$APP"
        deploy_app "$APP"
        ;;
    all)
        for app in consumer creator admin; do
            build_app "$app"
            deploy_app "$app"
        done
        ;;
    *)
        log_error "Unknown app: $APP"
        echo "Usage: $0 [consumer|creator|admin|all]"
        exit 1
        ;;
esac

log_info "Frontend deployment complete!"
