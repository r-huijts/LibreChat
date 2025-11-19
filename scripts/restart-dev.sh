#!/bin/bash
echo "Restarting LibreChat..."

# Find and kill the node processes associated with the dev servers
# This is a bit aggressive, but effective for a dev environment restart script
pkill -f "npm run backend:dev"
pkill -f "npm run frontend:dev"
pkill -f "node.*api/server/index.js"
pkill -f "vite"

echo "Waiting for processes to exit..."
sleep 2

# Restart using the start script
./scripts/start-dev.sh

