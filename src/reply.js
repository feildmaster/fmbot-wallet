module.exports = function privateReply({ cid }, msg, text) {
  const reply = {
    uid: cid,
    target: msg.cid,
    channel: msg.uid,
    text,
    type: 'private',
    timeReceived: Date.now(),
  };
  if (msg.data && msg.data.interactionId) reply.data = { interactionId: msg.data.interactionId };
  return reply;
};
