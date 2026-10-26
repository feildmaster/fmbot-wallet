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

const names = Object.entries(definitions)
  .flatMap(([name, definition]) => [name, ...(definition.aliases || [])]);

module.exports = { definitions, names };
