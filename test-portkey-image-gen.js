#!/usr/bin/env node

/**
 * Portkey Image Generation Test Script
 * 
 * This script tests image generation through Portkey to diagnose
 * the response format from gemini-2.5-flash-image-preview
 */

const https = require('https');
const http = require('http');

// ============================================================================
// Configuration
// ============================================================================

const PORTKEY_API_KEY = 'ktw6lAKV3hSX2UdS9do/L6raip6c';
const PORTKEY_CONFIG = 'pc-em-rhu-5927e5';
const MODEL = 'gemini-2.5-flash-image-preview';
const PROMPT = 'generate an image of a monkey with a banana';

// Color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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
// Test Functions
// ============================================================================

/**
 * Make request to Portkey API
 */
function makePortkeyRequest(requestBody) {
  return new Promise((resolve, reject) => {
    const bodyString = JSON.stringify(requestBody);
    
    const options = {
      hostname: 'api.portkey.ai',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
        'x-portkey-api-key': PORTKEY_API_KEY,
        'x-portkey-config': PORTKEY_CONFIG,
      },
    };

    log('📤 Request Details:', 'yellow');
    console.log('URL:', `https://${options.hostname}${options.path}`);
    console.log('Headers:', JSON.stringify({
      ...options.headers,
      'x-portkey-api-key': PORTKEY_API_KEY.slice(0, 10) + '...',
    }, null, 2));
    console.log('Body:', JSON.stringify(requestBody, null, 2));

    const req = https.request(options, (res) => {
      let data = '';
      let chunks = [];

      log(`\n📥 Response Status: ${res.statusCode}`, 'yellow');
      log('Response Headers:', 'yellow');
      console.log(JSON.stringify(res.headers, null, 2));

      res.on('data', (chunk) => {
        data += chunk;
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          rawChunks: chunks,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(bodyString);
    req.end();
  });
}

/**
 * Analyze response structure
 */
function analyzeResponse(response) {
  logSection('📊 Response Analysis');

  // Try to parse as JSON
  let parsed;
  try {
    parsed = JSON.parse(response.body);
    log('✅ Response is valid JSON', 'green');
  } catch (e) {
    log('❌ Response is NOT valid JSON', 'red');
    log('Raw response:', 'red');
    console.log(response.body.substring(0, 1000));
    return null;
  }

  // Detect response format
  logSection('🔍 Response Structure Detection');
  
  if (parsed.choices) {
    log('✅ Found OpenAI-style "choices" array', 'green');
    console.log('Number of choices:', parsed.choices.length);
    
    if (parsed.choices[0]) {
      const firstChoice = parsed.choices[0];
      console.log('\nFirst choice structure:');
      console.log(JSON.stringify(Object.keys(firstChoice), null, 2));
      
      if (firstChoice.message) {
        log('\n✅ Found "message" object', 'green');
        const message = firstChoice.message;
        console.log('Message keys:', Object.keys(message));
        console.log('Message role:', message.role);
        console.log('Content type:', typeof message.content);
        
        if (typeof message.content === 'string') {
          log('\n📝 Content is STRING', 'cyan');
          console.log('Content length:', message.content.length);
          console.log('Content preview (first 500 chars):');
          console.log(message.content.substring(0, 500));
          
          // Check for image markers
          if (message.content.includes('data:image')) {
            log('\n✅ Contains data URI image!', 'green');
          }
          if (message.content.includes('![')) {
            log('✅ Contains markdown image syntax!', 'green');
          }
        } else if (Array.isArray(message.content)) {
          log('\n📦 Content is ARRAY', 'cyan');
          console.log('Array length:', message.content.length);
          
          message.content.forEach((item, idx) => {
            console.log(`\nContent[${idx}]:`, JSON.stringify(item, null, 2).substring(0, 300));
          });
        } else if (typeof message.content === 'object') {
          log('\n📦 Content is OBJECT', 'cyan');
          console.log(JSON.stringify(message.content, null, 2).substring(0, 500));
        }
      }
    }
  }
  
  if (parsed.candidates) {
    log('\n✅ Found Google-style "candidates" array', 'green');
    console.log('Number of candidates:', parsed.candidates.length);
    
    if (parsed.candidates[0]) {
      const firstCandidate = parsed.candidates[0];
      console.log('\nFirst candidate structure:');
      console.log(JSON.stringify(Object.keys(firstCandidate), null, 2));
      
      if (firstCandidate.content) {
        log('\n✅ Found "content" object', 'green');
        const content = firstCandidate.content;
        console.log('Content keys:', Object.keys(content));
        
        if (content.parts) {
          log('\n✅ Found "parts" array', 'green');
          console.log('Number of parts:', content.parts.length);
          
          content.parts.forEach((part, idx) => {
            console.log(`\nPart[${idx}]:`, JSON.stringify(Object.keys(part)));
            
            if (part.text) {
              console.log('  Text:', part.text.substring(0, 100));
            }
            if (part.inlineData) {
              log('  ✅ Found inlineData!', 'green');
              console.log('  MIME type:', part.inlineData.mimeType);
              console.log('  Data length:', part.inlineData.data?.length || 0);
              console.log('  Data preview:', part.inlineData.data?.substring(0, 50));
            }
          });
        }
      }
    }
  }

  if (parsed.data) {
    log('\n✅ Found "data" array (image generation format)', 'green');
    console.log('Number of items:', parsed.data.length);
    
    parsed.data.forEach((item, idx) => {
      console.log(`\nData[${idx}]:`);
      if (item.url) {
        console.log('  URL:', item.url.substring(0, 100));
      }
      if (item.b64_json) {
        console.log('  Base64 length:', item.b64_json.length);
        console.log('  Base64 preview:', item.b64_json.substring(0, 50));
      }
    });
  }

  if (parsed.error) {
    log('\n❌ Found ERROR in response', 'red');
    console.log(JSON.stringify(parsed.error, null, 2));
  }

  return parsed;
}

/**
 * Save response to file
 */
function saveResponse(response, parsed) {
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Save raw response
  const rawFilename = `/workspaces/portkey-response-raw-${timestamp}.txt`;
  fs.writeFileSync(rawFilename, response.body);
  log(`\n💾 Saved raw response to: ${rawFilename}`, 'green');
  
  // Save parsed JSON
  if (parsed) {
    const jsonFilename = `/workspaces/portkey-response-parsed-${timestamp}.json`;
    fs.writeFileSync(jsonFilename, JSON.stringify(parsed, null, 2));
    log(`💾 Saved parsed JSON to: ${jsonFilename}`, 'green');
  }
  
  // Save headers
  const headersFilename = `/workspaces/portkey-response-headers-${timestamp}.json`;
  fs.writeFileSync(headersFilename, JSON.stringify(response.headers, null, 2));
  log(`💾 Saved headers to: ${headersFilename}`, 'green');
}

// ============================================================================
// Main Test Execution
// ============================================================================

async function runTests() {
  logSection('🎬 Starting Portkey Image Generation Test');
  
  log('Model:', 'bright');
  console.log(MODEL);
  log('\nPrompt:', 'bright');
  console.log(PROMPT);

  // Test 1: Standard chat completion request
  logSection('TEST 1: Standard Chat Completion Format');
  
  try {
    const requestBody1 = {
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: PROMPT,
        },
      ],
    };
    
    const response1 = await makePortkeyRequest(requestBody1);
    const parsed1 = analyzeResponse(response1);
    
    if (parsed1) {
      saveResponse(response1, parsed1);
    }
  } catch (error) {
    log(`\n❌ Test 1 Failed: ${error.message}`, 'red');
    console.error(error);
  }

  // Test 2: With explicit parameters (if needed)
  logSection('TEST 2: With Additional Parameters');
  
  try {
    const requestBody2 = {
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: PROMPT,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    };
    
    const response2 = await makePortkeyRequest(requestBody2);
    const parsed2 = analyzeResponse(response2);
    
    if (parsed2) {
      logSection('📊 Comparison with Test 1');
      log('Check the saved files to compare responses', 'yellow');
    }
  } catch (error) {
    log(`\n❌ Test 2 Failed: ${error.message}`, 'red');
    console.error(error);
  }

  logSection('✅ Tests Complete!');
  log('\nNext Steps:', 'bright');
  console.log('1. Review the saved JSON files');
  console.log('2. Look for "inlineData", "b64_json", or "url" fields');
  console.log('3. Check if the response is OpenAI-compatible or Google-native format');
  console.log('4. Share the parsed JSON with the team for further analysis');
}

// ============================================================================
// Run the tests
// ============================================================================

runTests().catch((error) => {
  log('\n💥 Fatal Error:', 'red');
  console.error(error);
  process.exit(1);
});

