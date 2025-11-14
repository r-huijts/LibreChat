# SearXNG Configuration

This directory contains the configuration for the self-hosted SearXNG search engine.

## What is SearXNG?

SearXNG is a privacy-respecting, hackable metasearch engine that aggregates results from multiple search engines without tracking users.

## Configuration

The main configuration file is `settings.yml`. On first boot, SearXNG will use this file to configure the search engine.

### Important Settings

- **secret_key**: Change this in production! Generate a random key with:
  ```bash
  openssl rand -hex 32
  ```

- **safe_search**: Control content filtering (0=off, 1=moderate, 2=strict)

- **engines**: Enable/disable specific search engines in the `engines` section

## Usage with LibreChat

The SearXNG instance is automatically configured when using `docker-compose.override.yml` or `deploy-compose.yml`.

### Environment Variables

Set these in your `.env` file:

```bash
SEARXNG_INSTANCE_URL=http://searxng:8080
SEARXNG_API_KEY=  # Optional: if you enable authentication
SEARXNG_BASE_URL=http://localhost:8080/
```

### Accessing SearXNG

- **Internal (from containers)**: `http://searxng:8080`
- **External (from host)**: `http://localhost:8080` (if ports are exposed)

### Enabling in LibreChat

Uncomment the searxng configuration in `librechat.yaml`:

```yaml
websearch:
  providers:
    searxng:
      searxngInstanceUrl: '${SEARXNG_INSTANCE_URL}'
      searxngApiKey: '${SEARXNG_API_KEY}'
```

### Using with MCP Server

Configure the SearXNG MCP server in your LibreChat MCP configuration:

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

## Customization

You can customize search engines, UI themes, and behavior by editing `settings.yml`. See the [official documentation](https://docs.searxng.org/admin/settings/) for all available options.

## Security Notes

- Keep the `secret_key` secure
- Consider enabling authentication for production deployments
- Review and disable any search engines you don't want to use
- Monitor logs for unusual activity

## Troubleshooting

### Container won't start
- Check that port 8080 is not already in use
- Verify the `settings.yml` syntax is valid YAML
- Check container logs: `docker logs searxng`

### No search results
- Verify the container is running: `docker ps | grep searxng`
- Test the API directly: `curl http://localhost:8080/search?q=test&format=json`
- Check if search engines are enabled in `settings.yml`

### Performance issues
- Adjust `request_timeout` and `max_request_timeout` in settings
- Reduce the number of enabled search engines
- Consider increasing container resources

