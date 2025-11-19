#!/bin/bash
# Find and restart the piper-tts container
CONTAINER_ID=$(docker ps -q -f name=piper-tts 2>/dev/null || docker compose ps -q piper-tts 2>/dev/null)
if [ -n "$CONTAINER_ID" ]; then
  echo "Restarting piper-tts container: $CONTAINER_ID"
  docker restart $CONTAINER_ID 2>/dev/null || docker compose restart piper-tts 2>/dev/null
else
  echo "Piper-tts container not found. May need to rebuild devcontainer."
fi
