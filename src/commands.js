const definitions = {
  balance: {
    description: 'Check your wallet balance',
    aliases: ['wallet'],
    private: true,
    args: [{
      name: 'currency',
      description: 'Which currency to show',
      type: 'string',
      required: false,
    }],
  },
};

module.exports = { definitions };
