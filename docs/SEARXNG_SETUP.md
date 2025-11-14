# SearXNG Integration Summary

## What Was Added

SearXNG, a privacy-focused metasearch engine, has been integrated into your LibreChat Docker architecture following the same pattern as the code-interpreter-proxy. This instance is intentionally exposed only through the SearXNG MCP server so the built-in LibreChat websearch module remains untouched.

## Files Modified

### Docker Compose Files
- **`docker-compose.override.yml`** - Added searxng service for development
- **`deploy-compose.yml`** - Added searxng service for production

### Configuration Files
- **`librechat.yaml`** - Already has a searxng config block (still commented out because builtin websearch stays disabled)
- **`librechat.example.yaml`** - Same as above for reference

### Documentation
- **`START_DEVCONTAINER.md`** - Added SearXNG startup instructions
- **`DEPLOY_PRODUCTION.md`** - Added SearXNG deployment steps
- **`docs/search.md`** - Added quick start guide for SearXNG integration

### New Files Created
- **`searxng/settings.yml`** - Default SearXNG configuration
- **`searxng/README.md`** - SearXNG configuration guide
- **`.gitignore`** - Added patterns to ignore SearXNG runtime data

## Quick Start

### For Development

1. **Start the devcontainer:**
   ```bash
   cd .devcontainer
   docker compose up -d
   ```
   
   SearXNG will start automatically on port 8080.

2. **Test SearXNG:**
   ```bash
   curl http://localhost:8080/search?q=test&format=json
   ```

3. **Register the MCP server** inside your LibreChat MCP configuration:
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

### For Production

1. **Ensure searxng directory exists:**
   ```bash
   mkdir -p searxng
   ```

2. **Update secret key in `searxng/settings.yml`:**
   ```bash
   # Generate a secure key
   openssl rand -hex 32
   
   # Edit searxng/settings.yml and replace the secret_key
   nano searxng/settings.yml
   ```

3. **Deploy:**
   ```bash
   docker compose -f deploy-compose.yml up -d
   ```

## MCP Server Integration

To use SearXNG with the MCP (Model Context Protocol) server:

1. **Install the MCP server:**
   ```bash
   npm install -g @modelcontextprotocol/server-searxng
   ```

2. **Configure in your MCP settings:**
   ```yaml
   mcpServers:
     searxng:
       command: npx
       args:
         - -y
         - "@modelcontextprotocol/server-searxng"
       env:
         SEARXNG_URL: "http://searxng:8080"
         # Optional: SEARXNG_API_KEY if you enable auth
   ```

3. **From inside containers**, use the internal hostname:
   - `http://searxng:8080` (container-to-container)

4. **From your host machine**, use:
   - `http://localhost:8080` (exposed port in dev mode)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ LibreChat API Container                                 │
│                                                         │
│  Dependencies:                                          │
│   - mongodb                                             │
│   - rag_api                                             │
│   - code-interpreter-proxy                              │
│   - searxng  ← NEW (for MCP server usage)               │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ SearXNG Container                                       │
│                                                         │
│  Image: searxng/searxng:latest                         │
│  Port: 8080                                             │
│  Config: ./searxng → /etc/searxng                      │
│                                                         │
│  Features:                                              │
│   • Privacy-focused metasearch                          │
│   • Aggregates 70+ search engines                      │
│   • No tracking, no logging                             │
│   • JSON API for programmatic access                    │
└─────────────────────────────────────────────────────────┘
```

## Accessing SearXNG

### Internal (from containers)
```
http://searxng:8080
```

### External (from host)

**Development (docker-compose.override.yml):**
```
http://localhost:8080
```

**Production (deploy-compose.yml):**
Ports are not exposed by default for security. To expose:
```yaml
# In deploy-compose.yml, uncomment:
searxng:
  ports:
    - "8080:8080"
```

## Customization

Edit `searxng/settings.yml` to customize:

- **Search engines**: Enable/disable specific engines
- **UI theme**: Change appearance
- **Safe search**: Content filtering level
- **Language**: Default search language
- **Results format**: HTML, JSON, etc.

See `searxng/README.md` for detailed configuration options.

## Security Notes

### Production Checklist
- [ ] Update `secret_key` in `searxng/settings.yml`
- [ ] Consider enabling authentication (API key)
- [ ] Review enabled search engines
- [ ] Don't expose port 8080 externally unless necessary
- [ ] Monitor logs for unusual activity

### Authentication (Optional)

SearXNG supports authentication. To enable:

1. Configure authentication in `searxng/settings.yml`
2. Pass `SEARXNG_API_KEY` to the MCP server environment (not LibreChat)
3. Update the MCP configuration with the key

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs searxng

# Verify config syntax
docker exec searxng cat /etc/searxng/settings.yml
```

### No search results
```bash
# Test directly
curl http://localhost:8080/search?q=test&format=json

# Check which engines are enabled
curl http://localhost:8080/config
```

### Port conflict
```bash
# Check what's using port 8080
lsof -i :8080

# Change port in docker-compose file if needed
```

### Settings not applying
```bash
# Restart container
docker restart searxng

# Or rebuild
docker compose -f deploy-compose.yml up -d --force-recreate searxng
```

## Next Steps

1. **Test the integration**: Start your devcontainer and verify SearXNG works
2. **Configure engines**: Edit `searxng/settings.yml` to enable your preferred search engines
3. **Set up MCP**: Configure `@modelcontextprotocol/server-searxng` for agent-based web search
4. **Deploy to production**: Follow `DEPLOY_PRODUCTION.md` with SearXNG included

## Resources

- **SearXNG Documentation**: https://docs.searxng.org/
- **MCP SearXNG Server**: https://github.com/modelcontextprotocol/servers/tree/main/src/searxng
- **Local Configuration**: See `searxng/README.md`

---

*Deployed with precision by your friendly neighborhood code monkey.* 🐒✨

