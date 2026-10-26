const utils = require('@basedakp48/plugin-utils');
const createHandler = require('./src/handle');
const createLookup = require('./src/lookup');

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

plugin.messageSystem().on('message-in', (msg) => {
  handle(msg)
    .then((text) => {
      if (!text) return null;
      return plugin.messageSystem().sendMessage({
        uid: plugin.cid,
        target: msg.cid,
        channel: msg.uid,
        text,
        type: 'private',
        timeReceived: Date.now(),
      });
    })
    .catch(report);
});
