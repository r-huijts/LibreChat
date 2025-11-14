# Deploy Local Changes to Production Server

## Overview
Deploy your local LibreChat customizations to the remote server by pushing your local changes to git, then pulling and rebuilding in production mode on the server.

## Workflow Summary
1. **Local Development** → Make changes in devcontainer
2. **Commit & Push** → Push changes to git repository
3. **Remote Pull** → SSH to server and pull changes
4. **Production Build** → Build and deploy with deploy-compose.yml

## Your Local Customizations to Deploy

### Code Changes
- **`client/vite.config.ts`**: `host: '0.0.0.0'` (line 13)
  - Required for Docker networking
  - Must be committed to git

### Configuration Files
- **`librechat.yaml`**: Your custom configuration
- **`.env`**: Production environment variables (created on server, not committed)

### Any UI/Code Changes
- Any modifications in `client/src/`
- Any modifications in `api/`
- Any modifications in `packages/`

## Step-by-Step Deployment

### Part 1: On Your Local Machine

#### Step 1: Ensure vite.config.ts Change is Committed
```bash
cd /Users/happyhawking/Documents/Projects/Current/LibreChat

# Check if vite.config.ts change is staged
git status

# If modified but not committed, add it
git add client/vite.config.ts

# Commit the change
git commit -m "Configure Vite for Docker networking (host: 0.0.0.0)"
```

#### Step 2: Commit Your Other Changes
```bash
# Review your changes
git status
git diff

# Add specific files or all changes
git add .

# Commit with descriptive message
git commit -m "Your descriptive commit message"

# Example commits:
# git commit -m "Add custom UI features"
# git commit -m "Update librechat.yaml configuration"
# git commit -m "Configure registration settings"
```

#### Step 3: Push to Remote Repository
```bash
# Push to main branch (or your working branch)
git push origin main

# Or if working on a feature branch
git push origin your-branch-name

# Verify push succeeded
git log --oneline -3
```

#### Step 4: Optional - Create Version Tag
```bash
# Create a version tag for this release
git tag -a v1.0.0 -m "Production release 1.0.0"

# Push the tag
git push origin v1.0.0
```

### Part 2: On Your Remote Server

#### Step 5: Connect to Remote Server
```bash
# From your local terminal
ssh user@your-server-ip

# Or using SSH config
ssh your-server-name
```

#### Step 6: Navigate to LibreChat Directory
```bash
cd /path/to/librechat
# Example: cd /home/deploy/librechat or cd ~/librechat
```

#### Step 7: Backup Current State
```bash
# Backup .env file
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Note current version
git log --oneline -1 > /tmp/previous-version.txt

# Optional: Backup database
docker exec chat-mongodb mongodump --out /backup/$(date +%Y%m%d_%H%M%S)
```

#### Step 8: Stop Running Services
```bash
# Stop production services
docker compose -f deploy-compose.yml down

# Verify stopped
docker ps
```

#### Step 9: Pull Your Local Changes
```bash
# Fetch latest from remote
git fetch origin

# If you pushed to main
git pull origin main

# Or if you pushed to a specific branch
git pull origin your-branch-name

# Or checkout a specific tag
git checkout v1.0.0

# Verify you have the latest changes
git log --oneline -5
git diff HEAD~1 client/vite.config.ts  # Verify vite.config change is present
```

#### Step 10: Verify vite.config.ts Change
```bash
# Check that host is set to 0.0.0.0
grep "host:" client/vite.config.ts

# Should show: host: '0.0.0.0',
```

#### Step 11: Verify librechat.yaml Exists
```bash
# Check if librechat.yaml exists and is a file (not a directory)
ls -lh librechat.yaml

# Should show: -rw-r--r-- ... librechat.yaml (file, not drwxr-xr-x which is directory)

# If it doesn't exist, copy from example
[ ! -f librechat.yaml ] && cp librechat.example.yaml librechat.yaml

# Verify it's a file with content
head -5 librechat.yaml
```

**Important:** If `librechat.yaml` doesn't exist before starting Docker, Docker will create it as a **directory** which causes errors. Always ensure it exists as a **file** before the first `docker compose up`.

#### Step 11a: Initialize SearXNG Configuration
```bash
# Create searxng directory if it doesn't exist
mkdir -p searxng

# Verify the directory was created
ls -ld searxng

# The settings.yml file should already be in git
# If not, create minimal config:
[ ! -f searxng/settings.yml ] && echo "use_default_settings: true" > searxng/settings.yml

# Generate a secure secret key for production
SEARXNG_SECRET=$(openssl rand -hex 32)
echo "Update searxng/settings.yml with secret_key: $SEARXNG_SECRET"
```

**Note:** For production, edit `searxng/settings.yml` and update the `secret_key` with a secure random value.

#### Step 12: Create/Update Production .env
```bash
# Edit .env (or create if doesn't exist)
nano .env
```

**Production .env content:**
```env
# Server Configuration
HOST=0.0.0.0
PORT=3080
NODE_ENV=production

# MongoDB Configuration
MONGO_URI=mongodb://mongodb:27017/LibreChat

# Meilisearch Configuration
MEILI_HOST=http://meilisearch:7700
MEILI_NO_ANALYTICS=true
MEILI_MASTER_KEY=<GENERATE_SECURE_KEY>

# RAG API Configuration
RAG_PORT=8000
RAG_API_URL=http://rag_api:8000

# Security Secrets - GENERATE SECURE RANDOM STRINGS
SESSION_SECRET=<GENERATE_SECURE_SECRET>
JWT_SECRET=<GENERATE_SECURE_SECRET>
JWT_REFRESH_SECRET=<GENERATE_SECURE_SECRET>
CREDS_KEY=<64_CHAR_HEX>
CREDS_IV=<32_CHAR_HEX>

# Registration Settings (from your local setup)
ALLOW_REGISTRATION=true
ALLOW_SOCIAL_LOGIN=false
ALLOW_SOCIAL_REGISTRATION=false
ALLOW_UNVERIFIED_EMAIL_LOGIN=true

# UID and GID
UID=1000
GID=1000
```

**Generate secrets (if needed):**
```bash
openssl rand -base64 32  # For SESSION_SECRET, JWT_SECRET, JWT_REFRESH_SECRET
openssl rand -hex 32     # For CREDS_KEY
openssl rand -hex 16     # For CREDS_IV
openssl rand -base64 48  # For MEILI_MASTER_KEY
```

#### Step 13: Configure Production Build

Edit `deploy-compose.yml`:
```bash
nano deploy-compose.yml
```

**Change lines 3-7 to:**
```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    # image: ghcr.io/danny-avila/librechat-dev-api:latest
    container_name: LibreChat-API
```

Save and exit (Ctrl+X, Y, Enter in nano)

#### Step 14: Build Production Images from Your Code
```bash
# Build fresh (recommended for first deployment or major changes)
docker compose -f deploy-compose.yml build --no-cache

# Or build with cache (faster for minor updates)
docker compose -f deploy-compose.yml build
```

**This builds from YOUR local changes:**
- Installs dependencies
- Builds packages (data-provider, data-schemas, api, client-package)
- Builds frontend static assets (with your UI changes)
- Creates production-optimized image
- Takes 5-15 minutes

#### Step 15: Start Production Services
```bash
# Start all services
docker compose -f deploy-compose.yml up -d

# Monitor startup
docker compose -f deploy-compose.yml logs -f api
```

Press Ctrl+C to exit logs when you see:
```
Server listening on all interfaces at port 3080
```

#### Step 15a: Wire the MCP Server
```bash
# On the host running your MCP tooling (can be outside Docker)
# ensure the searxng server entry points to the internal container URL
cat <<'YAML'
mcpServers:
  searxng:
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-searxng"
    env:
      SEARXNG_URL: "http://searxng:8080"
YAML
```

If the MCP process runs on your laptop instead of inside Docker, change `SEARXNG_URL` to `http://localhost:8080`.

#### Step 16: Verify Deployment
```bash
# Check all containers running
docker compose -f deploy-compose.yml ps

# Test backend
curl http://localhost:3080

# Check logs for errors
docker compose -f deploy-compose.yml logs --tail 50 api

# Verify your changes are live (e.g., check registration is enabled)
curl http://localhost:3080 | grep -i "librechat"
```

#### Step 17: Access and Test
**From your local machine**, test the remote server:
```bash
# Test from local terminal
curl http://your-server-ip:3080

# Or visit in browser
open http://your-server-ip:3080
```

**Test your customizations:**
1. Navigate to the application
2. Verify registration is enabled (your .env setting)
3. Create admin account (first user)
4. Test any UI changes you made
5. Verify custom librechat.yaml settings

## Quick Reference: Full Workflow

### Local → Production Deployment
```bash
# === ON LOCAL MACHINE ===
cd /Users/happyhawking/Documents/Projects/Current/LibreChat

# Commit your changes
git add .
git commit -m "Your changes description"
git push origin main

# === ON REMOTE SERVER ===
ssh user@server
cd /path/to/librechat

# Deploy your changes
docker compose -f deploy-compose.yml down
git pull origin main
docker compose -f deploy-compose.yml up -d --build

# Verify
docker compose -f deploy-compose.yml ps
curl http://localhost:3080
```

## Iterative Development Workflow

### Making More Changes Later

**1. Local Development:**
```bash
# Start your local devcontainer (if not running)
cd /Users/happyhawking/Documents/Projects/Current/LibreChat/.devcontainer
docker compose up -d

# Make your changes in VS Code or your editor
# Test locally at http://localhost:3090
```

**2. Commit and Push:**
```bash
git add .
git commit -m "New feature or fix"
git push origin main
```

**3. Deploy to Production:**
```bash
ssh user@server
cd /path/to/librechat
docker compose -f deploy-compose.yml down
git pull origin main
docker compose -f deploy-compose.yml up -d --build
```

## What Gets Deployed

### From Your Local Changes:
✅ Code changes in `client/src/` (UI modifications)
✅ Code changes in `api/` (backend modifications)  
✅ Code changes in `packages/` (shared code)
✅ `client/vite.config.ts` changes
✅ `librechat.yaml` configuration
✅ Any other committed changes

### NOT Deployed (Development Only):
❌ `.devcontainer/` changes (stays local)
❌ `.env` file (recreated on server)
❌ `node_modules/` (rebuilt on server)
❌ Local database data

## Important Notes

### 1. vite.config.ts Change is Critical
The `host: '0.0.0.0'` change must be committed because:
- Production build uses Vite to build static assets
- Without it, build process might have issues
- It's safe for production (only affects build process)

### 2. .env is Environment-Specific
- Local .env: Development settings
- Remote .env: Production settings (secure secrets)
- Never commit .env to git
- Recreate on server with production values

### 3. librechat.yaml is Deployed
- Your custom configuration file
- Commit and push it
- Gets pulled and used in production

### 4. First User is Admin
- First person to register gets admin role
- Make sure you register first on production

## Rollback Procedure

If deployment fails:
```bash
# On remote server
docker compose -f deploy-compose.yml down

# Restore previous .env
cp .env.backup.YYYYMMDD_HHMMSS .env

# Revert to previous commit
git log --oneline -10
git checkout <previous-commit-hash>
# Or use tag: git checkout v0.9.0

# Rebuild and start
docker compose -f deploy-compose.yml build
docker compose -f deploy-compose.yml up -d

# Verify
docker compose -f deploy-compose.yml ps
```

## Troubleshooting

### "Changes not appearing in production"
```bash
# Verify you pulled latest code
git log --oneline -3
git status

# Force rebuild without cache
docker compose -f deploy-compose.yml build --no-cache
docker compose -f deploy-compose.yml up -d
```

### "Build fails"
```bash
# Check Docker space
docker system df
docker system prune -a

# Check logs
docker compose -f deploy-compose.yml logs

# Verify .env exists
ls -la .env
```

### "Config file YAML format is invalid: EISDIR"
This error means `librechat.yaml` was created as a directory instead of a file.

```bash
# Stop containers
docker compose -f deploy-compose.yml down

# Remove the directory
sudo rm -rf librechat.yaml

# Create proper file
cp librechat.example.yaml librechat.yaml

# Verify it's a file (should show "-rw-r--r--" not "drwxr-xr-x")
ls -ld librechat.yaml

# Start again
docker compose -f deploy-compose.yml up -d
```

### "Can't access application"
```bash
# Check firewall
sudo ufw status
sudo ufw allow 3080/tcp

# Check if service is running
docker compose -f deploy-compose.yml ps

# Check logs
docker compose -f deploy-compose.yml logs api
```

## Security Checklist

Before going live:
- [ ] Strong, unique secrets in production `.env`
- [ ] `NODE_ENV=production` set
- [ ] Firewall configured (allow 80/443, restrict 3080)
- [ ] Consider setting `ALLOW_UNVERIFIED_EMAIL_LOGIN=false` and configure email
- [ ] SSL/TLS certificates installed
- [ ] Regular backup schedule for database
- [ ] Monitoring configured

## Summary

**Your workflow:**
```
Local Dev (devcontainer) 
  → Test at localhost:3090
  → Commit changes
  → Push to git
  → SSH to server
  → Pull changes  
  → Build production image
  → Deploy with deploy-compose.yml
  → Access at server-ip:3080
```

**Quick deployment command (on server):**
```bash
cd /path/to/librechat && \
git pull origin main && \
docker compose -f deploy-compose.yml up -d --build
```

