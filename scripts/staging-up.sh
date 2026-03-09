#!/bin/bash
set -e
cd "$(dirname "$0")/.."
docker compose --profile staging up -d --build
echo ""
echo "Staging is up:"
echo "  Web:        https://dale.poundit.co.uk"
echo "  Admin:      https://dale-admin.poundit.co.uk"
echo "  API:        https://dale-api.poundit.co.uk"
echo ""
echo "Tear down: ./scripts/staging-down.sh"
