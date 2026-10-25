const crypto = require('crypto');

const DEFAULT_URL = 'https://us-central1-feildbase.cloudfunctions.net';
const TIMEOUT = 10000;

module.exports = function createLookup({
  key,
  baseUrl = DEFAULT_URL,
  fetch: request = fetch,
  timeout = TIMEOUT,
}) {
  if (!key) throw new Error('A lookup key is required');

  return async function lookup(uid, currency) {
    const body = JSON.stringify({ uid, currency });
    const signature = crypto.createHmac('sha256', key).update(body).digest('hex');
    const response = await request(`${baseUrl}/wallet-lookup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', http_x_signature: signature },
      body,
      signal: AbortSignal.timeout(timeout),
    });
    return response.json();
  };
};
