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

  token(user, name) {
    const strategy = this.strategies.get('name');
    Hoek.assert(strategy, `Unknown strategy '${name}'`);
    Hoek.assert(
      strategy.type === 'entity' || strategy.type === 'resource',
      `Strategy '${name}' doesn't support tokens`
    );

    return this.store.id(user, strategy.options.client).find();
  }
};
