# SearXNG Integration Verification Checklist

Use this checklist to verify your SearXNG integration is working correctly.

## ✅ Pre-Flight Checks

### 1. Files Exist
```bash
# Verify all required files are in place
[ -f "searxng/settings.yml" ] && echo "✅ settings.yml" || echo "❌ settings.yml missing"
[ -f "searxng/README.md" ] && echo "✅ README.md" || echo "❌ README.md missing"
[ -f "SEARXNG_SETUP.md" ] && echo "✅ SEARXNG_SETUP.md" || echo "❌ SEARXNG_SETUP.md missing"
```

### 2. Configuration Files Updated
```bash
# Check docker-compose files include searxng
grep -q "searxng:" docker-compose.override.yml && echo "✅ override.yml" || echo "❌ override.yml"
grep -q "searxng:" deploy-compose.yml && echo "✅ deploy-compose.yml" || echo "❌ deploy-compose.yml"
grep -q "searxng:" .devcontainer/docker-compose.yml && echo "✅ devcontainer compose" || echo "❌ devcontainer compose"
```

### 3. Environment Variables
```bash
# Check .env.example has SEARXNG vars
grep -q "SEARXNG_INSTANCE_URL" .env.example && echo "✅ SEARXNG_INSTANCE_URL" || echo "❌ Missing"
grep -q "SEARXNG_API_KEY" .env.example && echo "✅ SEARXNG_API_KEY" || echo "❌ Missing"
```

## 🚀 Development Testing

### 1. Start DevContainer
```bash
cd .devcontainer
docker compose up -d
```

Expected output:
```
✅ Container chat-mongodb       Started
✅ Container chat-meilisearch   Started
✅ Container code-interpreter-proxy Started
✅ Container searxng            Started  ⬅️ NEW!
✅ Container devcontainer-app-1 Started
```

### 2. Verify SearXNG Container
```bash
docker ps | grep searxng
```

Should show:
```
searxng   searxng/searxng:latest   Up   0.0.0.0:8080->8080/tcp
```

### 3. Test SearXNG API
```bash
# Test search endpoint
curl -s "http://localhost:8080/search?q=test&format=json" | head -c 200

# Should return JSON with search results
```

### 4. Check SearXNG Logs
```bash
docker logs searxng --tail 20

# Should show no errors
# Look for: "Starting uWSGI" or similar startup messages
```

### 5. Test from LibreChat Container
```bash
# From inside the devcontainer app
docker exec devcontainer-app-1 curl -s http://searxng:8080/search?q=test&format=json | head -c 200

# Should return JSON (verifies container-to-container networking)
```

## 🔧 Configuration Testing

### 1. Check Settings Are Loaded
```bash
docker exec searxng cat /etc/searxng/settings.yml | head -20

# Should show your settings.yml content
```

### 2. Verify Environment Variables
```bash
docker exec searxng env | grep SEARXNG

# Should show:
# SEARXNG_BASE_URL=http://localhost:8080/
```

### 3. Test Different Search Engines
```bash
# Test with specific engine
curl -s "http://localhost:8080/search?q=test&format=json&engines=google"
curl -s "http://localhost:8080/search?q=test&format=json&engines=duckduckgo"
```

## 📦 Production Deployment

### 1. Pre-Deployment
```bash
# Generate secure secret key
openssl rand -hex 32

# Update searxng/settings.yml with the generated key
# sed -i 's/change_this_secret_key_in_production/YOUR_NEW_KEY_HERE/' searxng/settings.yml
```

### 2. Deploy
```bash
docker compose -f deploy-compose.yml up -d
```

### 3. Verify Production
```bash
# Check all containers
docker compose -f deploy-compose.yml ps

# Should show searxng as healthy/running

# Test internal endpoint (from API container)
docker exec LibreChat-API curl -s http://searxng:8080/search?q=test&format=json | head -c 200
```

## 🔌 MCP Server Integration

### 1. Install MCP Server
```bash
npm install -g @modelcontextprotocol/server-searxng
```

### 2. Configure MCP (in your MCP config file)
```yaml
mcpServers:
  searxng:
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-searxng"
    env:
      SEARXNG_URL: "http://searxng:8080"
```

### 3. Test MCP Connection
```bash
# From inside container/environment where MCP runs
curl -s "http://searxng:8080/search?q=test&format=json" | jq '.results | length'

# Should return a number (count of results)
```

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs searxng

# Common issues:
# - Port 8080 already in use
# - Invalid settings.yml syntax
# - Volume mount permission issues
```

### No Search Results
```bash
# Verify engines are enabled
docker exec searxng grep -A 5 "^engines:" /etc/searxng/settings.yml

# Test specific engine
curl "http://localhost:8080/search?q=test&engines=wikipedia&format=json"
```

### Container Networking Issues
```bash
# Test from API container
docker exec devcontainer-app-1 ping -c 2 searxng
docker exec devcontainer-app-1 curl -v http://searxng:8080/

# Check Docker network
docker network inspect devcontainer_default
```

### Settings Not Applying
```bash
# Restart container
docker restart searxng

# Force recreate
docker compose -f deploy-compose.yml up -d --force-recreate searxng
```

## ✨ Success Criteria

Your SearXNG integration is complete when:

- [ ] ✅ SearXNG container starts without errors
- [ ] ✅ Can access http://localhost:8080 from host
- [ ] ✅ Can curl http://searxng:8080 from API container
- [ ] ✅ Search returns JSON results
- [ ] ✅ Multiple search engines work
- [ ] ✅ Settings.yml is loaded correctly
- [ ] ✅ No errors in docker logs
- [ ] ✅ Production secret_key is changed
- [ ] ✅ MCP server can connect (optional)
- [ ] ✅ LibreChat can use searxng endpoint (optional)

## 📚 Additional Resources

- **Full Setup Guide**: `SEARXNG_SETUP.md`
- **Configuration**: `searxng/README.md`
- **Integration Guide**: `docs/search.md`
- **Dev Setup**: `START_DEVCONTAINER.md`
- **Prod Deploy**: `DEPLOY_PRODUCTION.md`
- **Official Docs**: https://docs.searxng.org/

---

*When all checks pass, you're ready to integrate web search with your LibreChat instance! 🎉*

