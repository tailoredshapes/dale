#!/bin/bash
set -e
cd "$(dirname "$0")/.."
docker compose --profile staging up -d --build
echo ""
echo "Staging is up:"
echo "  Web:        https://dale.poundit.co.uk"
echo "  Admin:      https://dale-admin.poundit.co.uk"
echo "  Consumer:   https://dale-consumer.poundit.co.uk"
echo "  Creator:    https://dale-creator.poundit.co.uk"
echo "  API:        https://dale-api.poundit.co.uk"
echo ""
echo "Tear down: ./scripts/staging-down.sh"
