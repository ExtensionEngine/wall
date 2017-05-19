'use strict';

// Load modules

const Crypto = require('crypto');

const Joi = require('joi');
const Hoek = require('hoek');

const Token = require('./Token');

// Declare internals

const internals = {};

internals.data = Joi.object({
  id: Joi.string().required(),
  user: Joi.string().required(),
  client: Joi.string().required(),
  strategy: Joi.string().required(),
  number: Joi.string().required(),
  details: Token.schema.required()
});

internals.id = function(user, userKey, client) {
  Hoek.assert(user && user[userKey], `Provided user must have ${userKey} key`);
  Hoek.assert(client && client.id, 'Provided client must have id key');

  return Crypto.createHash('sha256').update(`${user[userKey]}>${client.id}`).digest('hex');
};

internals.compose = function(token) {
  return Object.assign({}, token.details, { strategy: token.strategy });
};

// Define exports

module.exports = class Store {

  constructor(number, userKey) {
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

    this.number = number;
    this.userKey = userKey;
  }

  static schema() {
    return Joi.object({
      id: Joi.func().arity(2).required(),
      prepare: Joi.func().arity(3).required(),
      list: Joi.func().arity(1).required(),
      find: Joi.func().arity(1).required(),
      exists: Joi.func().arity(1).required(),
      upsert: Joi.func().arity(2).required(),
      remove: Joi.func().arity(1).required(),
      close: Joi.func().arity(0).required()
    });
  }

  id(user, client) {
    const value = internals.id(user, this.userKey, client);
    const find = () => this.find(value);
    const exists = () => this.exists(value);

    return { value, find, exists };
  }

  prepare(user, client, strategy, token) {
    const id = internals.id(user, this.userKey, client);
    const details = Object.assign({}, token);
    delete details.strategy; // Remove strategy added during wrap to avoid duplication during persisting

    const data = {
      id,
      user: user[this.userKey].toString(),
      client: client.id.toString(),
      strategy,
      number: this.number,
      details
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

  wrap(token) {
    if (Array.isArray(token)) {
      return token.map((el) => new Token(internals.compose(el)));
    }

    return token ? new Token(internals.compose(token)) : null;
  }

  list(user) {}

  find(id) {}

  exists(id) {}

  upsert(id, data) {}

  remove(id) {}

  close() {}
};
