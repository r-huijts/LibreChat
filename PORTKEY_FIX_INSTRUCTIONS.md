# 🔧 Fixing Portkey Image Generation in LibreChat

## Problem Diagnosis

Your Portkey config references a virtual key as a `provider`, which doesn't work:

```json
{
  "name": "gemini-2.5-flash-image-preview",
  "provider": "@nano-banana-via-openrouter",  // ❌ This is wrong
  "override_params": {
    "model": "@nano-banana-via-openrouter/google/gemini-2.5-flash-image-preview"
  }
}
```

Virtual keys are **not** providers. They're authentication wrappers.

---

## ✅ Solution 1: Use Virtual Key Directly in LibreChat (RECOMMENDED)

Update your `librechat.yaml`:

```yaml
custom:
  - name: 'Portkey-ImageGen'
    apiKey: '${PORTKEY_API_KEY}'  # Your Portkey API key
    baseURL: 'https://api.portkey.ai/v1'
    headers:
      x-portkey-api-key: '${PORTKEY_API_KEY}'
      x-portkey-virtual-key: 'nano-banana-via-openrouter'  # NO @ prefix!
      x-portkey-strict-open-ai-compliance: 'false'
    models:
      default:
        - 'google/gemini-2.5-flash-image-preview'
      fetch: false
    titleConvo: true
    titleModel: 'google/gemini-2.5-flash-image-preview'
    modelDisplayLabel: 'Gemini Image (Portkey)'
    iconURL: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg'
```

**Important Notes:**
- Virtual key name has **NO `@` prefix** in the header
- Model name is just the OpenRouter format: `google/gemini-2.5-flash-image-preview`
- Set `x-portkey-strict-open-ai-compliance: false` to allow Gemini's native format

---

## ✅ Solution 2: Fix Your Portkey Config

If you want to keep using config-based routing, update your Portkey config at `pc-em-rhu-5927e5`:

```json
{
  "strategy": {
    "mode": "conditional",
    "conditions": [
      {
        "query": {
          "params.model": {
            "$eq": "gemini-2.5-flash-image-preview"
          }
        },
        "then": "gemini-2.5-flash-image-preview"
      }
    ],
    "default": "mistral-medium"
  },
  "targets": [
    {
      "name": "gemini-2.5-flash-image-preview",
      "virtual_key": "nano-banana-via-openrouter",  // ✅ Use virtual_key, not provider
      "override_params": {
        "model": "google/gemini-2.5-flash-image-preview"  // ✅ Clean model name
      }
    }
  ]
}
```

**Key Changes:**
- Use `"virtual_key"` field instead of `"provider"`
- Virtual key name has NO `@` prefix
- Model name in `override_params` is clean (no `@` prefix path)

---

## ✅ Solution 3: Create the Virtual Key (If It Doesn't Exist)

Based on our test, the virtual key might not exist. Create it in Portkey:

1. Go to **Portkey Dashboard** → **Virtual Keys**
2. Click **"+ New Virtual Key"**
3. Settings:
   - **Name**: `nano-banana-via-openrouter`
   - **Provider**: `openrouter`
   - **API Key**: Your OpenRouter API key
4. Save

---

## 🧪 Test After Fixing

Run this updated test script:

```bash
node /workspaces/test-portkey-fixed.js
```

Expected success indicators:
- Status code: `200`
- Response contains image data (either URL or base64)
- No "401 No auth credentials found" error

---

## 📋 Checklist

- [ ] Virtual key `nano-banana-via-openrouter` exists in Portkey dashboard
- [ ] Virtual key has OpenRouter API key configured
- [ ] OpenRouter account has access to Gemini models
- [ ] Either:
  - [ ] Updated `librechat.yaml` to use virtual key header directly (Solution 1), OR
  - [ ] Updated Portkey config to use `virtual_key` field (Solution 2)
- [ ] Restarted LibreChat
- [ ] Tested image generation in regular chat

---

## 🎯 Why This Works

The working OpenWebUI pipe shows that:

1. Virtual keys are passed via **header**: `x-portkey-virtual-key: nano-banana-via-openrouter`
2. The **model name** sent to Portkey is the OpenRouter format: `google/gemini-2.5-flash-image-preview`
3. The virtual key **handles the routing** to OpenRouter
4. OpenRouter **returns the response** which may include inline images

LibreChat needs to do the same thing - either:
- Set the virtual key header directly (Solution 1)
- Or configure Portkey's config to use `virtual_key` field properly (Solution 2)

