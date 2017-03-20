'use strict';

// Load modules

const EventEmitter = require('events');

const Hoek = require('hoek');

// Define exports

module.exports = class extends EventEmitter {

  constructor(store) {
    super();
    this.store = store;
    this.strategies = new Map();
  }

  add(strategy) {
    this.strategies.set(strategy.name, strategy);
  }

  token(user, name, exists = false) {
    const strategy = name ? this.strategies.get('name') : null;
    if (strategy) {
      Hoek.assert(strategy, `Unknown strategy '${name}'`);
      Hoek.assert(
        strategy.type === 'entity' || strategy.type === 'resource',
        `Strategy '${name}' doesn't support tokens`
      );

      const id = this.store.id(user, strategy.options.client);

      return exists ? id.exists() : id.find();
    }

    return this.store.list(user);
  }
};
