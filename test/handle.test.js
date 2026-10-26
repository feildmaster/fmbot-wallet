const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const createHandler = require('../src/handle');

let calls;
let errors;
let clock;
let response;
let handle;

const message = (overrides = {}) => ({
  type: 'text',
  uid: '555',
  cid: 'discord-cid',
  text: '.balance',
  data: { connectorType: 'discord' },
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

test('both command names work regardless of case', async () => {
  assert.equal(await handle(message({ text: '.WALLET', uid: '1' })), 'Your balance: 1,250 FMC');
  assert.equal(await handle(message({ text: '.Balance', uid: '2' })), 'Your balance: 1,250 FMC');
});

test('space between the prefix and the command is allowed', async () => {
  assert.equal(await handle(message({ text: '. wallet' })), 'Your balance: 1,250 FMC');
});

test('private messages do not need the prefix', async () => {
  const data = { connectorType: 'discord', isPM: true };
  assert.equal(await handle(message({ text: 'wallet', data })), 'Your balance: 1,250 FMC');
  assert.equal(await handle(message({ text: 'hello', data, uid: '2' })), null);
});

test('the prefix is required outside private messages', async () => {
  assert.equal(await handle(message({ text: 'balance' })), null);
});

test('another currency can be requested and is upper-cased', async () => {
  response = { GEM: 7 };
  assert.equal(await handle(message({ text: '.balance gem' })), 'Your balance: 7 GEM');
  assert.equal(calls[0].currency, 'GEM');
});

test('ignores messages that are not the command', async () => {
  assert.equal(await handle(message({ text: 'hello .balance' })), null);
  assert.equal(await handle(message({ text: '.balances' })), null);
  assert.equal(await handle(message({ text: '.' })), null);
  assert.equal(await handle(message({ text: '' })), null);
  assert.equal(calls.length, 0);
});

test('ignores non-text messages and other connectors', async () => {
  assert.equal(await handle(message({ type: 'command' })), null);
  assert.equal(await handle(message({ type: undefined })), null);
  assert.equal(await handle(message({ data: { connectorType: 'irc' } })), null);
  assert.equal(await handle(message({ data: undefined })), null);
  assert.equal(calls.length, 0);
});

test('rejects a malformed or reserved currency without calling the wallet', async () => {
  assert.equal(await handle(message({ text: '.balance ../x', uid: '1' })), 'Usage: .balance [currency]');
  assert.equal(await handle(message({ text: '.balance all', uid: '2' })), "I don't know the currency ALL.");
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
  const data = { connectorType: 'discord', interactionId: 'int1' };

  assert.equal(await handle(message({ data })), 'Your balance: 1,250 FMC');
  clock += 1000;

  assert.equal(await handle(message({ data })), 'Slow down, try again in a few seconds.');
  assert.equal(calls.length, 1);
});

test('the cooldown stays silent for typed commands and other plugins\' commands', async () => {
  await handle(message());
  clock += 1000;

  assert.equal(await handle(message()), null);
  assert.equal(await handle(message({ text: '.say hi', data: { connectorType: 'discord', interactionId: 'int2' } })), null);
});
