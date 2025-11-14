# Code Interpreter Proxy

FastAPI proxy for LibreChat code interpreter using llm-sandbox.

## Features

- Execute code in isolated Docker containers via llm-sandbox
- Support for multiple programming languages (Python, JavaScript, Java, C++, Go, R)
- Automatic plot capture from Matplotlib, Seaborn, Plotly, etc.
- File upload and download support
- Session management with automatic cleanup
- Authentication via API key
- Compatible with LibreChat agents API

## Configuration

Configuration is done via environment variables with the `CI_` prefix:

### Core Settings

- `CI_API_KEY` (default: `dev-ci-key`) - API key for authentication. Must match `LIBRECHAT_CODE_API_KEY` in LibreChat.
- `CI_BACKEND` (default: `docker`) - Backend for llm-sandbox (docker, kubernetes, podman)
- `CI_FILE_STORAGE_PATH` (default: `/data/code-interpreter`) - Directory for storing session files
- `CI_HOST` (default: `0.0.0.0`) - Server host
- `CI_PORT` (default: `8000`) - Server port

### Session Management

- `CI_SESSION_TTL_MINUTES` (default: `60`) - How long sessions stay alive after creation
- `CI_MAX_MEMORY_MB` (default: `512`) - Maximum memory per container
- `CI_MAX_RUN_TIMEOUT_SECONDS` (default: `30`) - Maximum execution timeout per code run

### File Limits

- `CI_MAX_FILE_SIZE_BYTES` (default: `10485760` = 10MB) - Maximum file upload size
- `CI_MAX_FILES_PER_SESSION` (default: `100`) - Maximum files per session
- `CI_MAX_FILES_PER_RUN` (default: `10`) - Maximum files that can be attached to a single run
- `CI_SANDBOX_SWEEP_ON_STARTUP` (default: `true`) - Whether to prune old llm-sandbox containers during startup
- `CI_SANDBOX_IMAGE_PREFIXES` (default: `["ghcr.io/vndee/sandbox-", "lfnovo/open_notebook"]`) - Image name prefixes treated as llm-sandbox containers
- `CI_SANDBOX_LABEL` (optional) - Docker label used to filter sandbox containers

## Session Lifecycle & Cleanup

### How Sessions Work

Each LibreChat conversation creates a **session** in the proxy. A session:

1. **Creates an llm-sandbox container** when first code execution is requested
2. **Persists for reuse** within the same conversation (files, installed packages, etc. are retained)
3. **Expires after TTL** (default 60 minutes from creation)
4. **Runs cleanup** every 60 seconds to remove expired sessions

### Container Cleanup

The proxy automatically cleans up Docker containers in the following scenarios:

1. **Session Expiry**: After `CI_SESSION_TTL_MINUTES` from creation
2. **Explicit Deletion**: When `DELETE /v1/librechat/sessions/{session_id}` is called
3. **Server Shutdown**: All sessions are gracefully closed when the proxy stops
4. **Startup Sweep**: On boot, the proxy prunes any llm-sandbox containers older than `CI_SESSION_TTL_MINUTES`, even if they were created before the reboot (configurable via `CI_SANDBOX_SWEEP_ON_STARTUP`)

### Monitoring Sessions

Use the sessions API to monitor active sessions:

```bash
# List all active sessions
curl -H "x-api-key: dev-ci-key" http://localhost:8000/v1/librechat/sessions

# Delete a specific session
curl -X DELETE -H "x-api-key: dev-ci-key" http://localhost:8000/v1/librechat/sessions/{session_id}
```

### Troubleshooting Orphaned Containers

If you see many old llm-sandbox containers still running:

1. **Check proxy logs** for cleanup activity:
   ```bash
   docker logs code-interpreter-proxy | grep -i cleanup
   ```

2. **List active sessions** to see what the proxy is tracking:
   ```bash
   curl -H "x-api-key: dev-ci-key" http://localhost:8000/v1/librechat/sessions
   ```

3. **Manually delete old sessions**:
   ```bash
   # Get all session IDs
   curl -H "x-api-key: dev-ci-key" http://localhost:8000/v1/librechat/sessions | jq -r '.sessions[].session_id'
   
   # Delete each one
   for id in $(curl -s -H "x-api-key: dev-ci-key" http://localhost:8000/v1/librechat/sessions | jq -r '.sessions[].session_id'); do
     curl -X DELETE -H "x-api-key: dev-ci-key" http://localhost:8000/v1/librechat/sessions/$id
   done
   ```

4. **Prune stopped containers** (if containers are stopped but not removed):
   ```bash
   docker container prune --filter "label=llm-sandbox"
   ```

5. **Force cleanup** by restarting the proxy (all sessions will be closed):
   ```bash
   docker restart code-interpreter-proxy
   ```

### Adjusting Cleanup Behavior

To make containers clean up faster, reduce the TTL:

```yaml
# In .devcontainer/docker-compose.yml
environment:
  - CI_SESSION_TTL_MINUTES=5  # Clean up after 5 minutes instead of 60
```

To disable session reuse entirely (new container per code execution):
- This would require code changes to call `session.close()` immediately after each run
- Not recommended as it increases latency and removes state persistence

## API Endpoints

### LibreChat Compatibility Routes

- `POST /exec` - Execute code (LibreChat format)
- `GET /files/{session_id}` - List session files
- `GET /download/{session_id}/{file_id}` - Download file

### Standard API Routes (under `/v1/librechat`)

- `POST /v1/librechat/runs` - Execute code
- `GET /v1/librechat/sessions` - List all active sessions
- `DELETE /v1/librechat/sessions/{session_id}` - Delete a session
- `POST /v1/librechat/files` - Upload file
- `GET /v1/librechat/files?session_id={id}` - List files for a session
- `GET /v1/librechat/files/{file_id}` - Download file
- `DELETE /v1/librechat/files/{file_id}` - Delete file
- `GET /v1/librechat/health` - Health check

## Development

### Running Locally

```bash
cd code-interpreter-proxy
pip install -e .
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Running Tests

```bash
pytest
```

### Building Docker Image

```bash
docker build -t code-interpreter-proxy .
```

## Integration with LibreChat

In LibreChat's `.env`:

```bash
LIBRECHAT_CODE_BASEURL=http://code-interpreter-proxy:8000
LIBRECHAT_CODE_API_KEY=your-secret-key-here
```

In the code-interpreter-proxy environment:

```bash
CI_API_KEY=your-secret-key-here
```

The keys must match for authentication to work.

## Logging

The proxy logs all session lifecycle events:

- Session creation/opening
- Code execution
- Plot capture
- Session expiry and cleanup
- Container closure

Check logs for debugging:

```bash
docker logs -f code-interpreter-proxy
```

## Architecture

```
LibreChat Agent
    ↓
POST /exec (code + session_id)
    ↓
Code Interpreter Proxy
    ↓
SessionManager (creates/reuses session)
    ↓
llm-sandbox (ArtifactSandboxSession)
    ↓
Docker Container (isolated execution)
    ↓
Returns: stdout, stderr, files (plots)
    ↓
Proxy stores files, returns metadata
    ↓
LibreChat displays results & plots
```

## License

See parent LibreChat repository.

