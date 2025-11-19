#!/usr/bin/env node

/**
 * Enhanced test to inspect Portkey's trace and understand config resolution
 */

const https = require('https');

const PORTKEY_API_KEY = 'ktw6lAKV3hSX2UdS9do/L6raip6c';
const PORTKEY_CONFIG = 'pc-em-rhu-5927e5';

function log(msg, color) {
  const colors = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bright: '\x1b[1m' };
  console.log(`${colors[color] || colors.reset}${msg}${colors.reset}`);
}

async function makeRequest(model, enableDebug = false) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10,
    });

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-portkey-api-key': PORTKEY_API_KEY,
      'x-portkey-config': PORTKEY_CONFIG,
    };
    
    if (enableDebug) {
      headers['x-portkey-debug'] = 'true';
    }

    const req = https.request({
      hostname: 'api.portkey.ai',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function test() {
  log('\n' + '='.repeat(80), 'cyan');
  log('🔍 PORTKEY CONFIG TRACE ANALYSIS', 'bright');
  log('='.repeat(80) + '\n', 'cyan');

  // Test the Gemini model
  log('📍 Testing: gemini-2.5-flash-image-preview', 'yellow');
  const result = await makeRequest('gemini-2.5-flash-image-preview', true);

  log('\n📊 Response Details:', 'cyan');
  console.log('Status:', result.statusCode);
  console.log('\n🔑 Key Headers:');
  console.log('  x-portkey-provider:', result.headers['x-portkey-provider']);
  console.log('  x-portkey-last-used-option-index:', result.headers['x-portkey-last-used-option-index']);
  console.log('  x-portkey-trace-id:', result.headers['x-portkey-trace-id']);
  console.log('  x-portkey-retry-attempt-count:', result.headers['x-portkey-retry-attempt-count']);

  log('\n📄 Response Body:', 'yellow');
  console.log(JSON.stringify(result.body, null, 2));

  log('\n' + '='.repeat(80), 'cyan');
  log('💡 DIAGNOSIS', 'bright');
  log('='.repeat(80) + '\n', 'cyan');

  if (result.headers['x-portkey-provider'] === 'openai') {
    log('❌ Problem: Portkey is still using "openai" as provider', 'red');
    log('\nPossible causes:', 'yellow');
    console.log('  1. Config cache not updated yet (wait 1-2 minutes)');
    console.log('  2. Config update didn\'t save properly in Portkey dashboard');
    console.log('  3. The "virtual_key" field might not be recognized');
    console.log('  4. You need to save/publish the config in Portkey UI');
  } else if (result.headers['x-portkey-provider'] === 'openrouter') {
    log('✅ Good! Provider is now "openrouter"', 'green');
    
    if (result.statusCode === 401) {
      log('\n⚠️  But still getting 401 error', 'yellow');
      log('\nThis means:', 'yellow');
      console.log('  • Provider routing is correct');
      console.log('  • But virtual key "nano-banana-via-openrouter" is missing or has no API key');
      console.log('  • Action: Create/configure the virtual key in Portkey dashboard');
    } else if (result.statusCode === 200) {
      log('\n🎉 SUCCESS! Everything works!', 'green');
    }
  }

  log('\n📋 Action Items:', 'cyan');
  console.log('1. Go to Portkey Dashboard');
  console.log('2. Find config: pc-em-rhu-5927e5');
  console.log('3. Verify target[2] shows:');
  console.log('   {');
  console.log('     "name": "gemini-2.5-flash-image-preview",');
  console.log('     "provider": "openrouter",  ← Should be THIS');
  console.log('     "virtual_key": "nano-banana-via-openrouter",  ← And THIS');
  console.log('     "override_params": {');
  console.log('       "model": "google/gemini-2.5-flash-image-preview"');
  console.log('     }');
  console.log('   }');
  console.log('4. Make sure you SAVED the config');
  console.log('5. If still showing "openai", check for typos or JSON errors');
  
  log('\n🔗 Portkey Trace URL:', 'cyan');
  const traceId = result.headers['x-portkey-trace-id'];
  if (traceId) {
    console.log(`https://app.portkey.ai/logs?trace_id=${traceId}`);
    log('\n  ↑ Open this URL to see full request details in Portkey dashboard', 'yellow');
  }
}

test().catch(err => {
  log('\n💥 Error: ' + err.message, 'red');
  process.exit(1);
});

