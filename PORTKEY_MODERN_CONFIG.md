# 🎯 Modern Portkey Configuration (Post-Virtual Keys)

## 📋 Problem Summary

Virtual keys are **deprecated** in Portkey. You need to use:
- **Provider slugs** in model names (like `@provider-slug/model-name`)
- **Direct API keys** in config targets
- **Model Catalog** approach

---

## ✅ Solution: Updated Portkey Config

### **Option 1: Using Provider Slug in Model Name (RECOMMENDED)**

Your working OpenWebUI pipe uses this approach - the model name itself contains the routing:

```json
{
  "strategy": {
    "mode": "conditional",
    "conditions": [
      {
        "query": { "params.model": { "$eq": "gemini-2.5-flash-image-preview" } },
        "then": "gemini-2.5-flash-image-preview"
      }
    ]
  },
  "targets": [
    {
      "name": "gemini-2.5-flash-image-preview",
      "provider": "openrouter",
      "api_key": "{{OPENROUTER_API_KEY}}",
      "override_params": {
        "model": "google/gemini-2.5-flash-image-preview"
      }
    }
  ]
}
```

**Key changes:**
- `"api_key": "{{OPENROUTER_API_KEY}}"` - Reference to your OpenRouter API key stored in Portkey
- Remove `virtual_key` field entirely
- Use placeholder syntax `{{KEY_NAME}}` for API keys stored in Portkey

---

### **Option 2: Using Provider Slug in Model Name (Direct)**

If you have the API key directly in the config:

```json
{
  "name": "gemini-2.5-flash-image-preview",
  "provider": "openrouter",
  "api_key": "sk-or-v1-xxxxx",  // Your actual OpenRouter API key
  "override_params": {
    "model": "google/gemini-2.5-flash-image-preview"
  }
}
```

⚠️ **Security Warning**: Don't put actual API keys in configs if they're shared/versioned!

---

### **Option 3: Using @ Prefix Model Slug (New Portkey Way)**

According to the new Model Catalog approach, you can specify the provider slug directly in the model name:

```json
{
  "strategy": {
    "mode": "conditional",
    "conditions": [
      {
        "query": { "params.model": { "$eq": "gemini-2.5-flash-image-preview" } },
        "then": "gemini-2.5-flash-image-preview"
      }
    ]
  },
  "targets": [
    {
      "name": "gemini-2.5-flash-image-preview",
      "override_params": {
        "model": "@openrouter/google/gemini-2.5-flash-image-preview"
      }
    }
  ]
}
```

This assumes:
- You have an **AI Provider Integration** named `openrouter` in your Portkey workspace
- It has your OpenRouter API key configured
- The `@openrouter/` prefix tells Portkey which integration to use

---

## 🔧 How to Set Up Provider Integration in Portkey

1. **Go to Portkey Dashboard** → **Providers** (or **AI Integrations**)
2. **Add OpenRouter Integration**:
   - Name: `openrouter` (or your custom name)
   - Provider: OpenRouter
   - API Key: Your OpenRouter API key
3. **Save**

Now in your config, you can reference it as:
- `@openrouter/model-name` in the model field
- OR use `provider: "openrouter"` + `api_key: "{{OPENROUTER_API_KEY}}"`

---

## 🧪 Test Updated Config

Your updated config should look like:

```json
{
  "strategy": {
    "mode": "conditional",
    "conditions": [
      {
        "query": { "params.model": { "$eq": "Cohere-embed-v3-multilingual" } },
        "then": "Cohere-embed-v3-multilingual"
      },
      {
        "query": { "params.model": { "$eq": "mistral-medium" } },
        "then": "mistral-medium"
      },
      {
        "query": { "params.model": { "$eq": "gemini-2.5-flash-image-preview" } },
        "then": "gemini-2.5-flash-image-preview"
      },
      {
        "query": { "params.model": { "$eq": "gpt-5-mini" } },
        "then": "gpt-5-mini"
      },
      {
        "query": { "params.model": { "$eq": "green-r" } },
        "then": "green-r"
      },
      {
        "query": { "params.model": { "$eq": "claude-sonnet-4" } },
        "then": "claude-sonnet-4"
      }
    ],
    "default": "mistral-medium"
  },
  "targets": [
    {
      "name": "Cohere-embed-v3-multilingual",
      "provider": "azure-ai",
      "override_params": {
        "model": "@azure-foundry-fhict/Cohere-embed-v3-multilingual"
      }
    },
    {
      "name": "mistral-medium",
      "provider": "azure-ai",
      "override_params": {
        "model": "@azure-foundry-fhict/mistral-medium-2505"
      }
    },
    {
      "name": "gemini-2.5-flash-image-preview",
      "provider": "openrouter",
      "api_key": "{{OPENROUTER_API_KEY}}",
      "override_params": {
        "model": "google/gemini-2.5-flash-image-preview"
      }
    },
    {
      "name": "gpt-5-mini",
      "provider": "azure-openai",
      "override_params": {
        "model": "@azure-openai2/gpt-5-mini"
      }
    },
    {
      "name": "green-r",
      "override_params": {
        "model": "@greenpt/green-r-raw"
      }
    },
    {
      "name": "claude-sonnet-4",
      "provider": "anthropic",
      "override_params": {
        "model": "@anthropic-models/claude-sonnet-4-20250514",
        "max_tokens": 64000
      }
    }
  ]
}
```

**Key addition:**
```json
"api_key": "{{OPENROUTER_API_KEY}}"
```

This references a stored API key in Portkey's secure vault.

---

## 📝 How to Store API Key in Portkey

### Method 1: Via UI
1. Go to **Portkey Dashboard** → **Settings** → **API Keys** (or **Vault**)
2. Add new key:
   - Name: `OPENROUTER_API_KEY`
   - Value: Your actual OpenRouter API key
3. Save

### Method 2: Via AI Provider Integration
1. Go to **Providers** → **Add Provider**
2. Select **OpenRouter**
3. Enter API key
4. The system will handle it automatically

---

## 🎯 Expected Behavior After Fix

When LibreChat sends:
```
model: "gemini-2.5-flash-image-preview"
```

Portkey will:
1. Match condition → route to target[2]
2. Use provider `openrouter`
3. Lookup `{{OPENROUTER_API_KEY}}` from vault
4. Send to OpenRouter: `google/gemini-2.5-flash-image-preview`
5. Return response with inline images

---

## 🔗 References

- [Portkey Virtual Keys Migration Guide](https://portkey.ai/docs/product/ai-gateway/virtual-keys)
- [Portkey Model Catalog](https://portkey.ai/docs/product/ai-gateway/model-catalog)
- [Portkey Provider Integrations](https://portkey.ai/docs/integrations/llms)

