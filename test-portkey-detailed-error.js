#!/usr/bin/env node

const https = require('https');

const PORTKEY_API_KEY = 'ktw6lAKV3hSX2UdS9do/L6raip6c';
const PORTKEY_CONFIG = 'pc-em-rhu-5927e5';

function makeRequest() {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'gemini-2.5-flash-image-preview',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10,
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
        console.log('\n📊 Status:', res.statusCode);
        console.log('\n📄 Error Response:');
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log(data);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error('Request failed:', err.message);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

makeRequest();

