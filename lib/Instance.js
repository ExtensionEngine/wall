'use strict';

// Load modules

const EventEmitter = require('events');

const Hoek = require('hoek');

const Util = require('./auth/Util');

// Declare internals

const internals = {};

internals.refresh = function(user, strategy, token) {
  if (token && token.expired()) {
    return strategy.type === 'entity' ? strategy.resource.refresh(user, token) : strategy.refresh(user, token);
  }

  return Promise.resolve(token);
};

// Define exports

module.exports = class extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.strategies = new Map();
    this.isStandalone = false;
  }

  add(strategy) {
    this.strategies.set(strategy.name, strategy);
  }

  token(user, name, exists = false) {
    const strategy = name ? this.strategies.get(name) : null;
    if (strategy) {
      Hoek.assert(strategy, `Unknown strategy '${name}'`);
      Hoek.assert(
        strategy.type === 'entity' || strategy.type === 'resource',
        `Strategy '${name}' doesn't support tokens`
      );

      const id = this.store.id(user, strategy.options.client);

      return exists ? id.exists() : id.find().then((token) => internals.refresh(user, strategy, token));
    }

    return this.store.list(user);
  }

  update(request, credentials, mergeArrays = true) {
    // Always get auth from session because one attached to the request can be a clone so changes won't persist
    const auth = Util.getAuthentication(request);
    Hoek.merge(auth.credentials, credentials, true, mergeArrays);
    Util.getSession(request).touch();
  }
};
