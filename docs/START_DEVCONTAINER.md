# Start Local LibreChat DevContainer

## Overview
Start the LibreChat development environment locally using the devcontainer setup with MongoDB, Meilisearch, backend API, and frontend dev server.

## Prerequisites
- Docker Desktop running
- Project located at `/Users/happyhawking/Documents/Projects/Current/LibreChat`

## Step-by-Step Startup

### Step 1: Navigate to DevContainer Directory
```bash
cd /Users/happyhawking/Documents/Projects/Current/LibreChat/.devcontainer
```

### Step 2: Start All Containers
```bash
docker compose up -d
```

This starts:
- `devcontainer-app-1` - Main development container (Node 20)
- `chat-mongodb` - MongoDB database (port 27017)
- `chat-meilisearch` - Search engine (port 7700)
- `code-interpreter-proxy` - Code execution proxy
- `searxng` - Privacy-focused search engine (port 8080)

**Expected output:**
```
Container chat-mongodb       Started
Container chat-meilisearch   Started
Container devcontainer-app-1 Started
```

### Step 3: Verify Containers Are Running
```bash
docker ps --filter "name=devcontainer\|chat-"
```

**Should show:**
- `devcontainer-app-1` with ports `0.0.0.0:3080->3080/tcp, 0.0.0.0:3090->3090/tcp`
- `chat-mongodb` 
- `chat-meilisearch`

### Step 4: Start Backend API
```bash
docker exec -d devcontainer-app-1 bash -c "cd /workspaces && npm run backend:dev > /tmp/backend.log 2>&1"
```

Wait 10 seconds for backend to fully start, then verify:
```bash
docker exec devcontainer-app-1 bash -c "tail -10 /tmp/backend.log"
```

**Expected output (last line):**
```
Server listening on all interfaces at port 3080. Use http://localhost:3080 to access it
```

### Step 5: Start Frontend Dev Server
```bash
docker exec -d devcontainer-app-1 bash -c "cd /workspaces && npm run frontend:dev > /tmp/frontend.log 2>&1"
```

Wait 10 seconds for Vite to start, then verify:
```bash
docker exec devcontainer-app-1 bash -c "tail -5 /tmp/frontend.log"
```

**Expected output:**
```
VITE v6.3.6  ready in XXX ms
➜  Local:   http://localhost:3090/
```

### Step 6: Access Your Application

**Frontend (Development):** http://localhost:3090
- Vite dev server with hot module replacement
- Auto-reloads on code changes

**Backend API:** http://localhost:3080
- Nodemon with auto-restart on file changes
- Proxied through frontend for API calls

### Step 7: Check Service Health

**Test backend:**
```bash
curl http://localhost:3080
```
Should return HTML (the served frontend)

**Test frontend:**
```bash
curl http://localhost:3090
```
Should return HTML with Vite dev server scripts

**Check logs in real-time:**
```bash
# Backend logs
docker exec devcontainer-app-1 bash -c "tail -f /tmp/backend.log"

# Frontend logs
docker exec devcontainer-app-1 bash -c "tail -f /tmp/frontend.log"

# Exit with Ctrl+C
```

## Quick Start Script (All-in-One)

Save this as `start-dev.sh` in the project root:
```bash
#!/bin/bash
set -e

echo "Starting devcontainer services..."
cd .devcontainer
docker compose up -d

echo "Waiting for containers to be ready..."
sleep 5

echo "Starting backend..."
docker exec -d devcontainer-app-1 bash -c "cd /workspaces && npm run backend:dev > /tmp/backend.log 2>&1"

echo "Starting frontend..."
docker exec -d devcontainer-app-1 bash -c "cd /workspaces && npm run frontend:dev > /tmp/frontend.log 2>&1"

echo "Waiting for services to start..."
sleep 10

echo ""
echo "✅ Development environment started!"
echo ""
echo "Frontend: http://localhost:3090"
echo "Backend:  http://localhost:3080"
echo ""
echo "View logs:"
echo "  docker exec devcontainer-app-1 bash -c 'tail -f /tmp/backend.log'"
echo "  docker exec devcontainer-app-1 bash -c 'tail -f /tmp/frontend.log'"
```

Make it executable:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

## Stopping the Development Environment

### Stop Backend and Frontend (Keep Containers)
```bash
docker exec devcontainer-app-1 bash -c "pkill -f 'npm run backend:dev'; pkill -f 'npm run frontend:dev'"
```

### Stop All Containers
```bash
cd /Users/happyhawking/Documents/Projects/Current/LibreChat/.devcontainer
docker compose down
```

### Stop Containers but Keep Data
```bash
docker compose stop
```

To restart later:
```bash
docker compose start
```

## Troubleshooting

### Containers Won't Start
```bash
# Check for port conflicts
lsof -i :3080
lsof -i :3090

# Remove old containers
docker compose down
docker compose up -d
```

### Backend/Frontend Not Starting
```bash
# Check if processes are already running
docker exec devcontainer-app-1 bash -c "ps aux | grep -E 'node|npm'"

# Kill old processes
docker exec devcontainer-app-1 bash -c "pkill -9 -f node"

# Restart services (repeat steps 4-5)
```

### Port Already in Use
If ports 3080 or 3090 are already in use:
```bash
# Find what's using the port
lsof -i :3080
lsof -i :3090

# Kill the process or change ports in .devcontainer/docker-compose.yml
```

### Check Logs for Errors
```bash
# Container logs
docker logs devcontainer-app-1

# Application logs
docker exec devcontainer-app-1 bash -c "tail -50 /tmp/backend.log"
docker exec devcontainer-app-1 bash -c "tail -50 /tmp/frontend.log"
```

### Rebuild Packages (If Dependencies Changed)
```bash
docker exec devcontainer-app-1 bash -c "cd /workspaces && npm ci"
docker exec devcontainer-app-1 bash -c "cd /workspaces && npm run build:packages"
```

## Development Workflow

### Making Code Changes
- **Frontend:** Edit files in `client/src/` - Vite will auto-reload
- **Backend:** Edit files in `api/` - Nodemon will auto-restart
- **Packages:** Edit files in `packages/` - May need to rebuild with `npm run build:packages`

### Accessing the Container Shell
```bash
docker exec -it devcontainer-app-1 bash
```

### Viewing Database
```bash
# Connect to MongoDB
docker exec -it chat-mongodb mongosh LibreChat

# List users
db.users.find().pretty()

# Exit with: exit
```

## Environment Variables

The devcontainer uses settings from `.env`:
- `ALLOW_REGISTRATION=true` - Registration enabled
- `ALLOW_UNVERIFIED_EMAIL_LOGIN=true` - No email verification needed
- `MONGO_URI=mongodb://mongodb:27017/LibreChat`
- `MEILI_HOST=http://meilisearch:7700`

To modify settings, edit `.env` and restart the backend (Step 4).

### Using SearXNG via MCP

1. Ensure SearXNG container is running (started automatically in Step 2)
2. Verify it's accessible:
   ```bash
   curl http://localhost:8080/search?q=test&format=json
   ```
3. Add the SearXNG MCP server to your LibreChat MCP configuration (see `searxng/README.md`)

## Summary

**Start everything:**
```bash
cd .devcontainer && docker compose up -d
docker exec -d devcontainer-app-1 bash -c "cd /workspaces && npm run backend:dev > /tmp/backend.log 2>&1"
docker exec -d devcontainer-app-1 bash -c "cd /workspaces && npm run frontend:dev > /tmp/frontend.log 2>&1"
```

**Access:**
- Frontend: http://localhost:3090
- Backend: http://localhost:3080

**Stop:**
```bash
cd .devcontainer && docker compose down
```

