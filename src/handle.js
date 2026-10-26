const { definitions } = require('./commands');

const DEFAULT_CURRENCY = 'FMC';
const CURRENCY_PATTERN = /^[a-z]{2,10}$/i;
const COOLDOWN = 5000;
const PROVIDER = 'discord.com';

module.exports = function createHandler({
  lookup,
  linkURL,
  now = Date.now,
  onError = console.error,
}) {
  const lastUsed = new Map();

  const notLinked = linkURL
    ? `Your Discord account isn't linked to a wallet yet. Link it here: ${linkURL}`
    : "Your Discord account isn't linked to a wallet yet.";

  return async function handle(msg) {
    if (!msg || msg.type !== 'command') return null;
    if (!msg.data || msg.data.connectorType !== 'discord') return null;
    if (!Object.hasOwn(definitions, msg.data.command)) return null;

    const { currency: arg } = msg.data.args || {};

    const time = now();
    if (time - (lastUsed.get(msg.uid) || 0) < COOLDOWN) {
      return msg.data.interactionId ? 'Slow down, try again in a few seconds.' : null;
    }
    lastUsed.set(msg.uid, time);

    if (arg !== undefined && !CURRENCY_PATTERN.test(arg)) {
      return 'Usage: .balance [currency]';
    }
    const currency = (arg || DEFAULT_CURRENCY).toUpperCase();
    if (currency === 'ALL') return `I don't know the currency ${currency}.`;

    let result;
    try {
      result = await lookup(`${PROVIDER}:::${msg.uid}`, currency);
    } catch (error) {
      onError(error);
      return "I couldn't reach the wallet right now. Try again in a moment.";
    }

    if (result && typeof result[currency] === 'number') {
      return `Your balance: ${result[currency].toLocaleString('en-US')} ${currency}`;
    }

    switch (result && result.error) {
      case 'User not found': return notLinked;
      case 'Invalid wallet': return "You don't have a wallet yet.";
      case 'Invalid currency': return `I don't know the currency ${currency}.`;
      default:
        onError(new Error(`Unexpected wallet response: ${JSON.stringify(result)}`));
        return 'Something went wrong checking your wallet.';
    }
  };
};
