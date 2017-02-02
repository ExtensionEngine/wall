'use strict';

// Load modules

const Crypto = require('crypto');

const Joi = require('joi');

const Token = require('./Token');

// Declare internals

const internals = {};

internals.schema = Joi.object({
  tid: Joi.string().optional(),
  user: Joi.string(),
  client: Joi.string(),
  details: Token.schema
});

// Define exports

module.exports = class {

  tid(user, client) {
    return Crypto.createHash('sha256').update(`${user.sub}>${client.id}`).digest('hex');
  }

  prepare(tid, user, client, token) {
    const threeArgs = arguments.length === 3;
    const _tid = threeArgs ? this.tid(tid, user) : tid;
    const _user = threeArgs ? tid : user;
    const _client = threeArgs ? user : client;
    const _token = threeArgs ? client : token;

    return {
      tid: _tid,
      user: _user.sub,
      client: _client.id,
      details: _token
    };
  }

  validate(data) {
    return new Promise((resolve, reject) => {
      const validation = internals.schema.validate(data, { stripUnknown: true });
      if (validation.error) {
        return reject(validation.error);
      }

      return resolve(validation.value);
    });
  }

  find(tid) {}

  upsert(tid, data) {}

  remove(tid) {}

  close() {}
};
