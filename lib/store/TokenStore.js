/* eslint-disable no-useless-constructor */
'use strict';

// Load modules

const Crypto = require('crypto');

const Joi = require('joi');

// Declare internals

const internals = {};

internals.schema = Joi.object({
  user: Joi.string(),
  client: Joi.string(),
  accessToken: Joi.string(),
  tokenType: Joi.string(),
  refreshToken: Joi.string().allow(null).optional(),
  expiresAt: Joi.date().timestamp('unix').raw()
}).unknown(true);

// Define exports

module.exports = class {

  tid(user, client) {
    return Crypto.createHash('sha256').update(`${user.sub}>${client.id}`).digest('hex');
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
