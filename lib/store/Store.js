'use strict';

// Load modules

const Crypto = require('crypto');

const Joi = require('joi');
const Hoek = require('hoek');

const Token = require('./Token');

// Declare internals

const internals = {};

internals.data = Joi.object({
  id: Joi.string(),
  user: Joi.string(),
  client: Joi.string(),
  strategy: Joi.string(),
  details: Token.schema
});

internals.id = function(user, client) {
  Hoek.assert(user && typeof user.sub === 'string', 'Provided user must have sub property');
  Hoek.assert(client && typeof client.id === 'string', 'Provided client must have id property');

  return Crypto.createHash('sha256').update(`${user.sub}>${client.id}`).digest('hex');
};

// Define exports

module.exports = class Store {

  constructor() {
    if (new.target === Store) {
      throw new Error('Cannot instantiate class "Store" directly');
    }

    if (this.list === undefined) {
      throw new Error('Method "list" not implemented');
    }

    if (this.find === undefined) {
      throw new Error('Method "find" not implemented');
    }

    if (this.exists === undefined) {
      throw new Error('Method "exists" not implemented');
    }

    if (this.upsert === undefined) {
      throw new Error('Method "upsert" not implemented');
    }

    if (this.remove === undefined) {
      throw new Error('Method "remove" not implemented');
    }

    if (this.close === undefined) {
      throw new Error('Method "close" not implemented');
    }
  }

  static schema() {
    return Joi.object({
      id: Joi.func().arity(2),
      prepare: Joi.func().arity(3),
      list: Joi.func().arity(1),
      find: Joi.func().arity(1),
      exists: Joi.func().arity(1),
      upsert: Joi.func().arity(2),
      remove: Joi.func().arity(1),
      close: Joi.func().arity(0)
    });
  }

  id(user, client) {
    const value = internals.id(user, client);
    const find = () => this.find(value);
    const exists = () => this.exists(value);

    return { value, find, exists };
  }

  prepare(user, client, strategy, token) {
    const id = internals.id(user, client);
    const data = {
      id,
      user: user.sub,
      client: client.id,
      strategy,
      details: token
    };
    const upsert = () => this.upsert(data);

    return { data, upsert };
  }

  validate(data) {
    return new Promise((resolve, reject) => {
      const validation = internals.data.validate(data, { stripUnknown: true });
      if (validation.error) {
        return reject(validation.error);
      }

      return resolve(validation.value);
    });
  }

  list(user) {}

  find(id) {}

  exists(id) {}

  upsert(id, data) {}

  remove(id) {}

  close() {}
};
