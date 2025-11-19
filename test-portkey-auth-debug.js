#!/usr/bin/env node

/**
 * Portkey Authentication & Virtual Key Debug Script
 * 
 * Tests if the virtual key @nano-banana-via-openrouter is accessible
 * and properly authenticated
 */

const https = require('https');

// ============================================================================
// Configuration
// ============================================================================

const PORTKEY_API_KEY = 'ktw6lAKV3hSX2UdS9do/L6raip6c';
const PORTKEY_CONFIG = 'pc-em-rhu-5927e5';
const MODEL = 'gemini-2.5-flash-image-preview';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// Test with direct virtual key reference
// ============================================================================

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const bodyString = JSON.stringify(body);
    
    const reqOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
        ...options.headers,
      },
    };

    log('📤 Request:', 'yellow');
    console.log('URL:', `https://${reqOptions.hostname}${reqOptions.path}`);
    console.log('Headers:', JSON.stringify({
      ...reqOptions.headers,
      'x-portkey-api-key': reqOptions.headers['x-portkey-api-key']?.slice(0, 10) + '...',
    }, null, 2));
    console.log('Body:', JSON.stringify(body, null, 2));

    const req = https.request(reqOptions, (res) => {
      let data = '';

      log(`\n📥 Response Status: ${res.statusCode}`, 'yellow');
      log('Response Headers:', 'yellow');
      console.log(JSON.stringify(res.headers, null, 2));

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
          log('\n✅ Response is valid JSON', 'green');
        } catch (e) {
          log('\n❌ Response is NOT valid JSON', 'red');
        }

        console.log('\n📄 Response Body:');
        console.log(data.substring(0, 2000));

        if (parsed?.error) {
          log('\n❌ ERROR in response:', 'red');
          console.log(JSON.stringify(parsed.error, null, 2));
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          parsed,
        });
      });
    });

    req.on('error', reject);
    req.write(bodyString);
    req.end();
  });
}

async function runTests() {
  logSection('🎬 Portkey Authentication Debug');

  // ========================================================================
  // TEST 1: With config ID (your current setup)
  // ========================================================================
  logSection('TEST 1: Using Config ID (pc-em-rhu-5927e5)');
  
  try {
    const response1 = await makeRequest(
      {
        hostname: 'api.portkey.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'x-portkey-api-key': PORTKEY_API_KEY,
          'x-portkey-config': PORTKEY_CONFIG,
        },
      },
      {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: 'generate an image of a monkey with a banana',
          },
        ],
      }
    );

    log('\n🔍 Key Diagnostics from Response:', 'cyan');
    console.log('Provider used:', response1.headers['x-portkey-provider']);
    console.log('Virtual key used:', response1.headers['x-portkey-virtual-key']);
    console.log('Target index:', response1.headers['x-portkey-last-used-option-index']);
    console.log('Retry attempts:', response1.headers['x-portkey-retry-attempt-count']);
    console.log('Trace ID:', response1.headers['x-portkey-trace-id']);
    
  } catch (error) {
    log(`\n❌ Test 1 Failed: ${error.message}`, 'red');
  }

  // ========================================================================
  // TEST 2: Directly specify virtual key in header
  // ========================================================================
  logSection('TEST 2: Directly Using Virtual Key Header');
  
  try {
    const response2 = await makeRequest(
      {
        hostname: 'api.portkey.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'x-portkey-api-key': PORTKEY_API_KEY,
          'x-portkey-virtual-key': '@nano-banana-via-openrouter',
        },
      },
      {
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: 'generate an image of a monkey with a banana',
          },
        ],
      }
    );

    log('\n🔍 Key Diagnostics from Response:', 'cyan');
    console.log('Provider used:', response2.headers['x-portkey-provider']);
    console.log('Virtual key used:', response2.headers['x-portkey-virtual-key']);
    
  } catch (error) {
    log(`\n❌ Test 2 Failed: ${error.message}`, 'red');
  }

  // ========================================================================
  // TEST 3: Test with a known working model (mistral-medium)
  // ========================================================================
  logSection('TEST 3: Testing with Working Model (mistral-medium)');
  
  try {
    const response3 = await makeRequest(
      {
        hostname: 'api.portkey.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'x-portkey-api-key': PORTKEY_API_KEY,
          'x-portkey-config': PORTKEY_CONFIG,
        },
      },
      {
        model: 'mistral-medium',
        messages: [
          {
            role: 'user',
            content: 'Say hello',
          },
        ],
      }
    );

    log('\n🔍 Key Diagnostics from Response:', 'cyan');
    console.log('Status:', response3.statusCode);
    console.log('Provider used:', response3.headers['x-portkey-provider']);
    console.log('Target index:', response3.headers['x-portkey-last-used-option-index']);
    
    if (response3.statusCode === 200) {
      log('✅ Mistral works! So the config routing itself is functional.', 'green');
    }
    
  } catch (error) {
    log(`\n❌ Test 3 Failed: ${error.message}`, 'red');
  }

  // ========================================================================
  // TEST 4: Check Portkey virtual keys API (if accessible)
  // ========================================================================
  logSection('TEST 4: Checking Virtual Key Configuration');
  
  try {
    log('Attempting to fetch virtual key details...', 'yellow');
    const response4 = await makeRequest(
      {
        hostname: 'api.portkey.ai',
        port: 443,
        path: '/v1/virtual-keys/@nano-banana-via-openrouter',
        method: 'GET',
        headers: {
          'x-portkey-api-key': PORTKEY_API_KEY,
        },
      },
      {}
    );

    if (response4.statusCode === 200) {
      log('✅ Virtual key is accessible!', 'green');
    } else {
      log('⚠️  Virtual key endpoint returned non-200', 'yellow');
    }
    
  } catch (error) {
    log(`\n⚠️  Could not access virtual key API (this might be expected): ${error.message}`, 'yellow');
  }

  // ========================================================================
  // ANALYSIS
  // ========================================================================
  logSection('📊 Analysis & Next Steps');
  
  log('Based on the test results above, the issue is likely one of:', 'bright');
  console.log('\n1. 🔑 Virtual Key Missing API Credentials');
  console.log('   → The @nano-banana-via-openrouter virtual key exists but has no OpenRouter API key configured');
  console.log('   → Fix: Add OpenRouter API key to the virtual key in Portkey dashboard\n');
  
  console.log('2. 🔀 Provider Mismatch');
  console.log('   → The virtual key is configured for the wrong provider');
  console.log('   → Expected: openrouter');
  console.log('   → Fix: Ensure virtual key is set to "openrouter" provider\n');
  
  console.log('3. 🎯 Model Name Format');
  console.log('   → The model name in override_params might need adjustment');
  console.log('   → Try: "google/gemini-2.5-flash-image-preview" (without @prefix)\n');
  
  console.log('4. 🌐 OpenRouter API Key Issues');
  console.log('   → Your OpenRouter account might not have access to Gemini models');
  console.log('   → Fix: Check OpenRouter dashboard for model access\n');

  log('\n💡 Recommended Fix:', 'green');
  console.log('Go to Portkey Dashboard → Virtual Keys → @nano-banana-via-openrouter');
  console.log('And verify:');
  console.log('  • Provider is set to "openrouter"');
  console.log('  • OpenRouter API key is configured');
  console.log('  • The API key has credits/access to Gemini models');
}

// ============================================================================
// Run
// ============================================================================

runTests().catch((error) => {
  log('\n💥 Fatal Error:', 'red');
  console.error(error);
  process.exit(1);
});

