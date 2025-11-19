#!/usr/bin/env node

/**
 * Check if Portkey config has updated
 * Tests multiple models to see routing behavior
 */

const https = require('https');

const PORTKEY_API_KEY = 'ktw6lAKV3hSX2UdS9do/L6raip6c';
const PORTKEY_CONFIG = 'pc-em-rhu-5927e5';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function testModel(model) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    });

    const req = https.request({
      hostname: 'api.portkey.ai',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-portkey-api-key': PORTKEY_API_KEY,
        'x-portkey-config': PORTKEY_CONFIG,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          model,
          status: res.statusCode,
          provider: res.headers['x-portkey-provider'],
          target: res.headers['x-portkey-last-used-option-index'],
        });
      });
    });

    req.on('error', () => resolve({ model, status: 'error', provider: 'error', target: 'error' }));
    req.write(body);
    req.end();
  });
}

async function main() {
  log('\n' + '='.repeat(80), 'cyan');
  log('🔍 PORTKEY CONFIG ROUTING TEST', 'bright');
  log('='.repeat(80) + '\n', 'cyan');

  const models = [
    'mistral-medium',                    // Should use target[1], provider: azure-ai
    'gemini-2.5-flash-image-preview',   // Should use target[2], provider: openrouter
    'gpt-5-mini',                       // Should use target[3], provider: azure-openai
  ];

  log('Testing multiple models to see routing behavior:\n', 'yellow');

  const results = [];
  for (const model of models) {
    const result = await testModel(model);
    results.push(result);
  }

  // Display results in table format
  console.log('┌────────────────────────────────────┬────────┬──────────────────┬─────────────┐');
  console.log('│ Model                              │ Status │ Provider         │ Target      │');
  console.log('├────────────────────────────────────┼────────┼──────────────────┼─────────────┤');
  
  for (const r of results) {
    const modelStr = r.model.padEnd(34);
    const statusStr = String(r.status).padEnd(6);
    const providerStr = (r.provider || 'N/A').padEnd(16);
    const targetStr = (r.target || 'N/A').padEnd(11);
    
    const statusColor = r.status === 200 ? 'green' : (r.status === 401 ? 'red' : 'yellow');
    log(`│ ${modelStr} │ ${statusStr} │ ${providerStr} │ ${targetStr} │`, statusColor);
  }
  console.log('└────────────────────────────────────┴────────┴──────────────────┴─────────────┘');

  log('\n' + '='.repeat(80), 'cyan');
  log('📊 ANALYSIS', 'bright');
  log('='.repeat(80) + '\n', 'cyan');

  const geminiResult = results.find(r => r.model === 'gemini-2.5-flash-image-preview');
  const mistralResult = results.find(r => r.model === 'mistral-medium');

  if (mistralResult?.provider === 'azure-ai' && mistralResult?.status === 200) {
    log('✅ Mistral routing works (azure-ai, status 200)', 'green');
  }

  if (geminiResult?.provider === 'openrouter') {
    log('✅ Gemini is routing to openrouter!', 'green');
    
    if (geminiResult.status === 401) {
      log('\n⚠️  But getting 401 error', 'yellow');
      log('This means:', 'yellow');
      console.log('  • Portkey config updated successfully ✅');
      console.log('  • Provider is correctly set to "openrouter" ✅');
      console.log('  • BUT: OpenRouter API key is missing or invalid ❌');
      console.log('\nAction needed:', 'bright');
      console.log('  1. Check Portkey Dashboard → Providers → OpenRouter');
      console.log('  2. Verify the OpenRouter API key is valid');
      console.log('  3. OR add API key directly to config target[2]');
    } else if (geminiResult.status === 200) {
      log('\n🎉 SUCCESS! Everything works!', 'green');
    }
  } else if (geminiResult?.provider === 'openai') {
    log('❌ Gemini is still routing to openai (not openrouter)', 'red');
    log('\nPossible causes:', 'yellow');
    console.log('  1. Config change not saved in Portkey dashboard');
    console.log('  2. Config cache not refreshed yet (wait 2 minutes)');
    console.log('  3. Wrong config being used');
    console.log('\nCurrent status:', 'bright');
    console.log(`  • Target: ${geminiResult.target}`);
    console.log(`  • Provider: ${geminiResult.provider} (expected: openrouter)`);
    console.log(`  • Status: ${geminiResult.status}`);
    
    log('\n💡 Try this:', 'cyan');
    console.log('  1. Open Portkey dashboard');
    console.log('  2. Go to config: pc-em-rhu-5927e5');
    console.log('  3. Look at target[2]');
    console.log('  4. Confirm it says: "provider": "openrouter"');
    console.log('  5. If not, update and SAVE');
    console.log('  6. Wait 1-2 minutes for cache refresh');
    console.log('  7. Run this test again');
  }

  log('\n📋 Summary:', 'cyan');
  console.log(`Config ID: ${PORTKEY_CONFIG}`);
  console.log(`Models tested: ${results.length}`);
  console.log(`Target[2] provider: ${geminiResult?.provider || 'unknown'}`);
  console.log(`Target[2] status: ${geminiResult?.status || 'unknown'}`);
}

main().catch(err => {
  log('\n💥 Error: ' + err.message, 'red');
  process.exit(1);
});

