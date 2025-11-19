#!/bin/bash
# Start backend in a new terminal tab/window (if possible) or background
# Since we can't easily open new terminal tabs from a script inside a container/remote shell effectively for the user to see separate outputs without a multiplexer, 
# we will use concurrently to run them in the same terminal but with labeled output.

# We will use npx to run concurrently to avoid permission issues with global install
echo "Starting LibreChat Backend and Frontend..."
npx concurrently --names "BACKEND,FRONTEND" --prefix-colors "blue,magenta" \
    "npm run backend:dev" \
    "npm run frontend:dev"

