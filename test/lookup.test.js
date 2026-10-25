const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { test } = require('node:test');

const createLookup = require('../src/lookup');

const fakeFetch = (payload) => {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return { json: async () => payload };
  };
  return { fetch, requests };
};

test('posts the signed json body to the lookup endpoint', async () => {
  const { fetch, requests } = fakeFetch({ FMC: 5 });
  const lookup = createLookup({ key: 'k', baseUrl: 'https://wallet.test', fetch });

  assert.deepEqual(await lookup('discord.com:::555', 'FMC'), { FMC: 5 });

  const [{ url, options }] = requests;
  assert.equal(url, 'https://wallet.test/wallet-lookup');
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), { uid: 'discord.com:::555', currency: 'FMC' });
  const expected = crypto.createHmac('sha256', 'k').update(options.body).digest('hex');
  assert.equal(options.headers.http_x_signature, expected);
});

test('uses the production wallet url by default', async () => {
  const { fetch, requests } = fakeFetch({});
  await createLookup({ key: 'k', fetch })('u', 'FMC');

  assert.equal(requests[0].url, 'https://us-central1-feildbase.cloudfunctions.net/wallet-lookup');
});

const serve = handler => new Promise((resolve) => {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => {
      server.closeAllConnections();
      return new Promise(done => server.close(done));
    },
  }));
});

test('gives up when the server never answers', async () => {
  const server = await serve(() => {});

  try {
    const started = Date.now();
    await assert.rejects(createLookup({ key: 'k', baseUrl: server.url, timeout: 150 })('u', 'FMC'));
    assert.ok(Date.now() - started < 2000);
  } finally {
    await server.close();
  }
});

test('gives up when the headers arrive but the body stalls', async () => {
  const server = await serve((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"FMC":');
  });

  try {
    const started = Date.now();
    await assert.rejects(createLookup({ key: 'k', baseUrl: server.url, timeout: 150 })('u', 'FMC'));
    assert.ok(Date.now() - started < 2000);
  } finally {
    await server.close();
  }
});

test('reads a complete answer from a real server', async () => {
  const server = await serve((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"FMC":42}');
  });

  try {
    assert.deepEqual(await createLookup({ key: 'k', baseUrl: server.url })('u', 'FMC'), { FMC: 42 });
  } finally {
    await server.close();
  }
});

test('refuses to start without a key', () => {
  assert.throws(() => createLookup({}), /key is required/);
});
