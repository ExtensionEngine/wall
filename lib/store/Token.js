'use strict';

// Load modules

const camelCase = require('lodash.camelcase');
const Joi = require('joi');
const mapKeys = require('lodash.mapkeys');
const snakeCase = require('lodash.snakecase');

// Declare internals

const internals = {
  offset: 10
};

internals.now = function() {
  return Math.floor(Date.now() / 1000);
};

internals.schema = Joi.object({
  accessToken: Joi.string().required(),
  tokenType: Joi.string().optional(),
  refreshToken: Joi.string().allow(null).optional(),
  expiresAt: Joi.date().timestamp('unix').raw().optional(),
  expiresIn: Joi.number().integer().positive().optional().strip()
})
  .or('expiresAt', 'expiresIn')
  .pattern(/^([A-Za-z0-9])+$/, [Joi.string(), Joi.number(), Joi.boolean(), Joi.object()]);

// Define exports

module.exports = class {
  constructor(props) {
    const normalized = mapKeys(props, (val, key) => camelCase(key));
    if (normalized.expiresIn && !normalized.expiresAt) {
      normalized.expiresAt = internals.now() + normalized.expiresIn;
    }

    const validation = internals.schema.validate(normalized);
    if (validation.error) {
      throw validation.error;
    }

    Object.assign(this, validation.value);
  }

  static get schema() {
    return internals.schema;
  }

  static set offset(offset) {
    internals.offset = offset;
  }

  denormalize() {
    return mapKeys(this, (val, key) => snakeCase(key));
  }

  expired() {
    return Math.max(this.expiresAt - (internals.now() + internals.offset), 0) === 0;
  }
};
