#!/usr/bin/env node

/**
 * Test script using the CORRECT virtual key setup
 * Based on the working OpenWebUI pipe configuration
 */

const https = require('https');

const PORTKEY_API_KEY = 'ktw6lAKV3hSX2UdS9do/L6raip6c';
const VIRTUAL_KEY = 'nano-banana-via-openrouter'; // NO @ prefix!
const MODEL = 'google/gemini-2.5-flash-image-preview'; // Clean OpenRouter format

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function makeRequest(headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    
    const options = {
      hostname: 'api.portkey.ai',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
    };

    log('\n' + '='.repeat(80), 'cyan');
    log('📤 REQUEST', 'bright');
    log('='.repeat(80), 'cyan');
    console.log('Headers:', JSON.stringify({
      ...options.headers,
      'x-portkey-api-key': '***' + (options.headers['x-portkey-api-key'] || '').slice(-6),
    }, null, 2));
    console.log('\nBody:', JSON.stringify(body, null, 2));

    const req = https.request(options, (res) => {
      let data = '';
      
      log('\n' + '='.repeat(80), 'cyan');
      log(`📥 RESPONSE (${res.statusCode})`, 'bright');
      log('='.repeat(80), 'cyan');
      console.log('Headers:', JSON.stringify(res.headers, null, 2));

      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('\n✅ Valid JSON response\n');
          console.log(JSON.stringify(parsed, null, 2));
          resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          console.log('\n❌ Non-JSON response:\n');
          console.log(data.substring(0, 2000));
          resolve({ statusCode: res.statusCode, headers: res.headers, data: null });
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function test() {
  log('\n🎬 Testing Portkey with CORRECT Virtual Key Setup', 'bright');
  log('Based on working OpenWebUI pipe configuration\n', 'yellow');

  // ========================================================================
  // TEST 1: Using virtual key header (like OpenWebUI pipe)
  // ========================================================================
  log('\n📍 TEST 1: Virtual Key in Header (OpenWebUI method)', 'cyan');
  
  try {
    const result1 = await makeRequest(
      {
        'x-portkey-api-key': PORTKEY_API_KEY,
        'x-portkey-virtual-key': VIRTUAL_KEY,  // NO @ prefix!
        'x-portkey-strict-open-ai-compliance': 'false',
      },
      {
        model: MODEL,
        messages: [{ role: 'user', content: 'generate an image of a monkey with a banana' }],
        max_tokens: 4096,
      }
    );

    log('\n' + '='.repeat(80), 'cyan');
    log('📊 ANALYSIS', 'bright');
    log('='.repeat(80), 'cyan');

    if (result1.statusCode === 200) {
      log('✅ SUCCESS! Status 200', 'green');
      
      if (result1.data?.choices?.[0]?.message) {
        const msg = result1.data.choices[0].message;
        const content = msg.content;
        
        log('\n📝 Response Content Type: ' + typeof content, 'yellow');
        
        if (typeof content === 'string') {
          log('Content length: ' + content.length, 'yellow');
          log('Content preview:', 'yellow');
          console.log(content.substring(0, 500));
          
          if (content.includes('data:image')) {
            log('\n🎉 FOUND INLINE IMAGE IN CONTENT!', 'green');
          } else if (content.includes('![')) {
            log('\n🎉 FOUND MARKDOWN IMAGE IN CONTENT!', 'green');
          }
        } else if (Array.isArray(content)) {
          log('Content is array with ' + content.length + ' parts', 'yellow');
          content.forEach((part, i) => {
            console.log(`\nPart ${i}:`, JSON.stringify(part, null, 2).substring(0, 300));
          });
        }
        
        if (msg.images) {
          log('\n🎉 FOUND IMAGES ARRAY IN MESSAGE!', 'green');
          console.log('Images:', JSON.stringify(msg.images, null, 2));
        }
      }
    } else if (result1.statusCode === 401) {
      log('❌ 401 Error - Authentication Failed', 'red');
      log('\nPossible causes:', 'yellow');
      console.log('  1. Virtual key "nano-banana-via-openrouter" does not exist');
      console.log('  2. Virtual key has no API key configured');
      console.log('  3. OpenRouter API key in virtual key is invalid');
    } else if (result1.statusCode === 400) {
      log('❌ 400 Error - Bad Request', 'red');
      if (result1.data?.message?.includes('not valid')) {
        log('\n🔑 Virtual key does NOT exist in Portkey!', 'red');
        log('\nAction Required:', 'yellow');
        console.log('  Create virtual key in Portkey Dashboard:');
        console.log('  Name: nano-banana-via-openrouter');
        console.log('  Provider: openrouter');
        console.log('  API Key: <your OpenRouter key>');
      }
    }
  } catch (error) {
    log(`\n❌ Request failed: ${error.message}`, 'red');
  }

  // ========================================================================
  // Final Recommendations
  // ========================================================================
  log('\n\n' + '='.repeat(80), 'cyan');
  log('💡 NEXT STEPS', 'bright');
  log('='.repeat(80), 'cyan');
  
  console.log('\nIf you got a 400 error saying virtual key is invalid:');
  console.log('  → Create the virtual key in Portkey dashboard');
  console.log('  → Name it exactly: nano-banana-via-openrouter (no @ prefix)');
  console.log('  → Set provider to: openrouter');
  console.log('  → Add your OpenRouter API key\n');
  
  console.log('If you got a 401 error:');
  console.log('  → Virtual key exists but has no OpenRouter API key');
  console.log('  → Or the OpenRouter key is invalid/expired\n');
  
  console.log('If you got 200 SUCCESS:');
  console.log('  → Update librechat.yaml with the config from PORTKEY_FIX_INSTRUCTIONS.md');
  console.log('  → Restart LibreChat');
  console.log('  → Test in the chat interface\n');
}

test().catch(err => {
  log('\n💥 Fatal error: ' + err.message, 'red');
  process.exit(1);
});

