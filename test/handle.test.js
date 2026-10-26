const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const createHandler = require('../src/handle');

let calls;
let errors;
let clock;
let response;
let handle;

const message = (overrides = {}) => ({
  type: 'command',
  uid: '555',
  cid: 'discord-cid',
  text: '.balance',
  data: { connectorType: 'discord', command: 'balance', args: {} },
  ...overrides,
});

const withCurrency = (currency, overrides = {}) => message({
  data: { connectorType: 'discord', command: 'balance', args: { currency } },
  ...overrides,
});

const build = (options = {}) => createHandler({
  lookup: async (uid, currency) => {
    calls.push({ uid, currency });
    if (response instanceof Error) throw response;
    return response;
  },
  now: () => clock,
  onError: error => errors.push(error),
  ...options,
});

beforeEach(() => {
  calls = [];
  errors = [];
  clock = 1000000;
  response = { FMC: 1250 };
  handle = build();
});

test('looks up the sender by their discord id and replies with the balance', async () => {
  assert.equal(await handle(message()), 'Your balance: 1,250 FMC');
  assert.deepEqual(calls, [{ uid: 'discord.com:::555', currency: 'FMC' }]);
});

test('another currency can be requested and is upper-cased', async () => {
  response = { GEM: 7 };
  assert.equal(await handle(withCurrency('gem')), 'Your balance: 7 GEM');
  assert.equal(calls[0].currency, 'GEM');
});

test('ignores messages that are not one of its commands', async () => {
  const other = { connectorType: 'discord', command: 'say', args: {} };

  assert.equal(await handle(message({ data: other })), null);
  assert.equal(await handle(message({ data: { connectorType: 'discord', args: {} } })), null);
  assert.equal(await handle(message({ data: { connectorType: 'discord', command: 'constructor' } })), null);
  assert.equal(await handle(message({ data: { connectorType: 'discord', command: '__proto__' } })), null);
  assert.equal(calls.length, 0);
});

test('ignores typed text, which the connector turns into a command when it is one, and other connectors', async () => {
  assert.equal(await handle(message({ type: 'text' })), null);
  assert.equal(await handle(message({ type: undefined })), null);
  assert.equal(await handle(message({ data: { connectorType: 'irc', command: 'balance' } })), null);
  assert.equal(await handle(message({ data: undefined })), null);
  assert.equal(await handle(null), null);
  assert.equal(calls.length, 0);
});

test('rejects a malformed or reserved currency without calling the wallet', async () => {
  assert.equal(await handle(withCurrency('../x', { uid: '1' })), 'Usage: .balance [currency]');
  assert.equal(await handle(withCurrency('all', { uid: '2' })), "I don't know the currency ALL.");
  assert.equal(calls.length, 0);
});

test('a user is rate limited for a few seconds', async () => {
  assert.equal(await handle(message()), 'Your balance: 1,250 FMC');
  clock += 1000;
  assert.equal(await handle(message()), null);
  clock += 5000;
  assert.equal(await handle(message()), 'Your balance: 1,250 FMC');
  assert.equal(calls.length, 2);
});

test('the rate limit is per user', async () => {
  await handle(message({ uid: '1' }));
  assert.equal(await handle(message({ uid: '2' })), 'Your balance: 1,250 FMC');
});

test('an unlinked account is told how to link, with a link when configured', async () => {
  response = { error: 'User not found' };
  assert.equal(await handle(message()), "Your Discord account isn't linked to a wallet yet.");

  handle = build({ linkURL: 'https://auth.example.com' });
  assert.equal(
    await handle(message()),
    "Your Discord account isn't linked to a wallet yet. Link it here: https://auth.example.com",
  );
});

test('wallet errors are turned into friendly messages', async () => {
  response = { error: 'Invalid wallet' };
  assert.equal(await handle(message({ uid: '1' })), "You don't have a wallet yet.");
  response = { error: 'Invalid currency' };
  assert.equal(await handle(message({ uid: '2' })), "I don't know the currency FMC.");
  assert.equal(errors.length, 0);
});

test('an unexpected response is reported and does not leak details', async () => {
  response = { error: 'Invalid transaction' };
  assert.equal(await handle(message()), 'Something went wrong checking your wallet.');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Invalid transaction/);
});

test('a network failure is reported and the user is told to retry', async () => {
  response = new Error('network down');
  assert.equal(await handle(message()), "I couldn't reach the wallet right now. Try again in a moment.");
  assert.deepEqual(errors.map(e => e.message), ['network down']);
});

test('someone using a slash command is told to slow down instead of left waiting', async () => {
  const data = {
    connectorType: 'discord', command: 'balance', args: {}, interactionId: 'int1',
  };

  assert.equal(await handle(message({ data })), 'Your balance: 1,250 FMC');
  clock += 1000;

  assert.equal(await handle(message({ data })), 'Slow down, try again in a few seconds.');
  assert.equal(calls.length, 1);
});

test('the cooldown stays silent for typed commands', async () => {
  await handle(message());
  clock += 1000;

  assert.equal(await handle(message()), null);
});

