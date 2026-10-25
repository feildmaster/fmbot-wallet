const PREFIX = '.';
const COMMANDS = ['wallet', 'balance'];
const DEFAULT_CURRENCY = 'FMC';
const CURRENCY_PATTERN = /^[a-z]{2,10}$/i;
const COOLDOWN = 5000;
const PROVIDER = 'discord.com';

function parse(msg) {
  const text = String(msg.text || '').trim();
  const prefixed = text.startsWith(PREFIX);
  if (!prefixed && !msg.data.isPM) return null;

  const [command, arg] = (prefixed ? text.slice(PREFIX.length).trim() : text).split(/\s+/);
  if (!COMMANDS.includes(command.toLowerCase())) return null;
  return { command: command.toLowerCase(), arg };
}

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
    if (!msg || msg.type !== 'text') return null;
    if (!msg.data || msg.data.connectorType !== 'discord') return null;

    const parsed = parse(msg);
    if (!parsed) return null;
    const { command, arg } = parsed;

    const time = now();
    if (time - (lastUsed.get(msg.uid) || 0) < COOLDOWN) return null;
    lastUsed.set(msg.uid, time);

    if (arg !== undefined && !CURRENCY_PATTERN.test(arg)) {
      return `Usage: ${PREFIX}${command} [currency]`;
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
