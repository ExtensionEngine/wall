'use strict';

// Load modules

const Crypto = require('crypto');

const Iron = require('iron');
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
  details: Joi.alternatives().try(Joi.string().regex(/^Fe26\.(\w|\*|-)+$/), Token.schema).required()
});

internals.id = function(user, userKey, client) {
  Hoek.assert(user && user[userKey], `Provided user must have ${userKey} key`);
  Hoek.assert(client && client.id, 'Provided client must have id key');

  return Crypto.createHash('sha256').update(`${user[userKey]}>${client.id}`).digest('hex');
};

internals.encrypt = function(token, password) {
  return new Promise((resolve, reject) => {
    Iron.seal(token, password, Iron.defaults, (err, sealed) => {
      if (err) {
        reject(err);
      }

      resolve(sealed);
    });
  });
};

internals.decrypt = function(token, password) {
  return new Promise((resolve, reject) => {
    Iron.unseal(token, password, Iron.defaults, (err, unsealed) => {
      if (err) {
        reject(err);
      }

      resolve(unsealed);
    });
  });
};

internals.compose = function(token) {
  return Object.assign({}, token.details, { strategy: token.strategy });
};

// Define exports

module.exports = class Store {
  constructor(number, encryption = {}, userKey) {
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
    this.encryption = encryption;
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
    let details = Object.assign({}, token);
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

    if (this.encryption.enabled) {
      return internals.encrypt(details, this.encryption.password)
        .then((encrypted) => {
          data.details = encrypted;
          return { data, upsert };
        });
    }

    return Promise.resolve({ data, upsert });
  }

  validate(data) {
    return new Promise((resolve, reject) => {
      const validation = internals.data.validate(data);
      if (validation.error) {
        return reject(validation.error);
      }

      return resolve(validation.value);
    });
  }

  wrap(token) {
    const doWrap = (tkn) => {
      if (this.encryption.enabled) {
        return internals.decrypt(tkn.details, this.encryption.password)
          .then((details) => {
            const composed = internals.compose(Object.assign(tkn, { details }));
            return new Token(composed);
          });
      }

      return Promise.resolve(new Token(internals.compose(tkn)));
    };

    if (Array.isArray(token)) {
      return Promise.all(token.map(doWrap));
    }

    return token ? doWrap(token) : Promise.resolve(null);
  }

  list(user) {}

  find(id) {}

  exists(id) {}

  upsert(id, data) {}

  remove(id) {}

  close() {}
};
