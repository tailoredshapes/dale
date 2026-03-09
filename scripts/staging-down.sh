#!/bin/bash
set -e
cd "$(dirname "$0")/.."
docker compose --profile staging down -v
echo "Staging is down."
