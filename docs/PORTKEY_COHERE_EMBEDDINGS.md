# Portkey Cohere Embeddings for RAG

This guide explains how to route LibreChat's RAG API embeddings through your Portkey AI gateway so Cohere's `embed-v3` models can be used without exposing OpenAI keys.

## Overview

```
LibreChat -> rag_api -> Portkey (Cohere) -> Cohere Embeddings
```

- `rag_api` calls the Portkey HTTP endpoint at `https://api.portkey.ai/v1/embeddings`.
- Portkey forwards to Cohere (e.g., `Cohere-embed-v3-multilingual`) and returns floats to the RAG API.
- All configuration is driven by environment variables so you can switch providers without code changes.

## Prerequisites

1. Working LibreChat Docker stack (devcontainer or production compose).
2. Portkey AI account with an API key that proxies Cohere's embeddings route.
3. Optional: Existing Cohere workspace if Portkey requires upstream credentials.

## Configuration

1. **Set your Portkey key** (export or add to `.env`):
   ```bash
   PORTKEY_API_KEY=pk-your-key-here
   ```

2. **Review `config/portkey.env`** (loaded by `rag_api` automatically):
   ```env
   EMBEDDINGS_PROVIDER=custom
   CUSTOM_EMBEDDINGS_URL=https://api.portkey.ai/v1/embeddings
   CUSTOM_EMBEDDINGS_MODEL=Cohere-embed-v3-multilingual
   CUSTOM_EMBEDDINGS_HEADERS={"x-portkey-api-key":"${PORTKEY_API_KEY}","Content-Type":"application/json"}
   CUSTOM_EMBEDDINGS_BODY_TEMPLATE={"model":"{{model}}","input":{{texts}},"encoding_format":"float"}
   ```
   - `CUSTOM_EMBEDDINGS_MODEL`: switch to `Cohere-embed-v3-english` if you only need English.
   - `CUSTOM_EMBEDDINGS_HEADERS`: Portkey's auth header; update if your gateway expects different metadata.

3. **Ensure compose picks up the file** (already wired):
   - Root `docker-compose.yml`: `env_file` includes `.env` and `./config/portkey.env`.
   - `.devcontainer/docker-compose.yml`: `env_file` includes `../config/portkey.env`.

4. **Restart the services**:
   ```bash
   docker compose up -d rag_api
   # or restart the entire stack
   docker compose up -d
   ```

5. **Optional: devcontainer rebuild** so the VS Code environment loads the new env file.

## Testing the Portkey endpoint

Before testing LibreChat, verify Portkey responds:

```bash
curl https://api.portkey.ai/v1/embeddings \
  -H "x-portkey-api-key: $PORTKEY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "input": "The food was delicious and the waiter...",
        "model": "Cohere-embed-v3-multilingual",
        "encoding_format": "float"
      }'
```

You should receive a JSON payload with `data[0].embedding`.

## Validating inside LibreChat

1. Start LibreChat (`docker compose up -d` or `Dev Containers: Rebuild`).
2. Upload a document to a conversation (File uploads rely on a healthy RAG API).
3. Ask a question referencing the uploaded file. Successful retrieval indicates that:
   - `rag_api` indexed the file.
   - Embeddings were generated via Portkey.
   - The vector store (`vectordb`) returned relevant chunks.

4. Check logs if anything fails:
   ```bash
   docker logs rag_api  # look for 4xx/5xx responses from Portkey
   docker logs vectordb # ensure Postgres/pgvector is healthy
   ```

## Switching Models or Providers

- Change `CUSTOM_EMBEDDINGS_MODEL` to any model exposed through Portkey (e.g., `Cohere-embed-v3-english`).
- For other gateways (OpenAI, HuggingFace TEI, Ollama), adjust the URL/headers/body template accordingly.
- No code updates are needed—composition env files supply everything.

## Notes & Tips

- Keep `PORTKEY_API_KEY` out of version control. Define it in `.env` or your secret manager.
- `encoding_format` is set to `float` to match Cohere's API. If Portkey exposes BF16/INT8, update accordingly.
- If you need retries, set `CUSTOM_EMBEDDINGS_TIMEOUT` or wrap Portkey with its own retry policy.

With this setup, LibreChat's RAG pipeline runs entirely through your Portkey/Cohere stack, avoiding direct OpenAI dependency while retaining high-quality embeddings.

