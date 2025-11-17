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

1. **Add these variables to your `.env` file**:
   ```env
   EMBEDDINGS_PROVIDER=portkey
   RAG_PORTKEY_API_KEY=your_portkey_api_key_here
   RAG_PORTKEY_BASEURL=https://api.portkey.ai/v1
   EMBEDDINGS_MODEL=Cohere-embed-v3-multilingual
   ```
   - `EMBEDDINGS_MODEL`: switch to `Cohere-embed-v3-english` if you only need English.
   - `RAG_PORTKEY_API_KEY`: Your Portkey API key (keep this out of version control).

2. **Restart the services**:
   ```bash
   docker compose up -d rag_api
   # or restart the entire stack
   docker compose up -d
   ```

3. **Optional: devcontainer rebuild** so the VS Code environment loads the new env file.

## Testing the Portkey endpoint

Before testing LibreChat, verify Portkey responds:

```bash
curl https://api.portkey.ai/v1/embeddings \
  -H "x-portkey-api-key: $RAG_PORTKEY_API_KEY" \
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

- Change `EMBEDDINGS_MODEL` to any model exposed through Portkey (e.g., `Cohere-embed-v3-english`).
- For other embedding providers (OpenAI, custom gateways, etc.), change `EMBEDDINGS_PROVIDER` and adjust related variables accordingly.
- No code updates are needed—environment variables control everything.

## Notes & Tips

- Keep `RAG_PORTKEY_API_KEY` out of version control. Define it in `.env` or your secret manager.
- The RAG API will automatically use the `portkey` provider when `EMBEDDINGS_PROVIDER=portkey` is set.
- If you need custom headers or body templates, use `EMBEDDINGS_PROVIDER=custom` with `CUSTOM_EMBEDDINGS_*` variables instead.

With this setup, LibreChat's RAG pipeline runs entirely through your Portkey/Cohere stack, avoiding direct OpenAI dependency while retaining high-quality embeddings.

