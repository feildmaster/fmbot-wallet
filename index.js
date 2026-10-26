const utils = require('@basedakp48/plugin-utils');
const { definitions } = require('./src/commands');
const createHandler = require('./src/handle');
const createLookup = require('./src/lookup');
const privateReply = require('./src/reply');

const lookup = createLookup({
  key: process.env.WALLET_LOOKUP_KEY,
  baseUrl: process.env.WALLET_URL || undefined,
});

const plugin = new utils.Plugin({ dir: __dirname });

const report = error => plugin.sendError(error).then(sent => sent || console.error(error));

const handle = createHandler({
  lookup,
  linkURL: process.env.WALLET_LINK_URL,
  onError: report,
});

plugin.presenceSystem();
plugin.defaultCommands(definitions);

plugin.messageSystem().on('message-in', (msg) => {
  handle(msg)
    .then((text) => {
      if (!text) return null;
      return plugin.messageSystem().sendMessage(privateReply(plugin, msg, text));
    })
    .catch(report);
});
