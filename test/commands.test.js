const assert = require('node:assert/strict');
const { test } = require('node:test');

const { validateCommands } = require('@basedakp48/plugin-utils');
const { definitions } = require('../src/commands');
const privateReply = require('../src/reply');

test('the published definitions pass the validation plugin-utils applies at startup', () => {
  assert.deepEqual(validateCommands(definitions), []);
});

test('the command is private and takes one optional currency', () => {
  const { balance } = definitions;

  assert.equal(balance.private, true);
  assert.equal(balance.args.length, 1);
  assert.deepEqual(
    { name: balance.args[0].name, type: balance.args[0].type, required: balance.args[0].required },
    { name: 'currency', type: 'string', required: false },
  );
});

test('the command can also be typed as wallet', () => {
  assert.deepEqual(definitions.balance.aliases, ['wallet']);
});

test('a reply to a slash command carries the interaction id and nothing else of the message', () => {
  const msg = {
    cid: 'connector', uid: 'u1', data: { interactionId: 'int1', server: 'Srv', nick: 'Al' },
  };

  const reply = privateReply({ cid: 'me' }, msg, 'Your balance: 5 FMC');

  assert.equal(reply.uid, 'me');
  assert.equal(reply.target, 'connector');
  assert.equal(reply.channel, 'u1');
  assert.equal(reply.type, 'private');
  assert.equal(reply.text, 'Your balance: 5 FMC');
  assert.deepEqual(reply.data, { interactionId: 'int1' });
});

test('a reply to ordinary text has no data at all, since the database refuses undefined', () => {
  const withData = privateReply({ cid: 'me' }, { cid: 'c', uid: 'u', data: { isPM: true } }, 'x');
  const withoutData = privateReply({ cid: 'me' }, { cid: 'c', uid: 'u' }, 'x');

  assert.equal('data' in withData, false);
  assert.equal('data' in withoutData, false);
  [withData, withoutData].forEach(reply => assert.equal(
    Object.values(reply).some(value => value === undefined),
    false,
  ));
});
