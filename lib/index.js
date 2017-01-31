'use strict';

// Load modules

const Joi = require('joi');

const EntityScheme = require('./scheme/EntityScheme');
const Log = require('./Log');
const MongoTokenStore = require('./store/MongoTokenStore');
const ResourceScheme = require('./scheme/ResourceScheme');
const Schema = require('./Schema');
const SessionScheme = require('./scheme/SessionScheme');
const Token = require('./store/Token');
const TokenStore = require('./store/TokenStore');

// Decalre internals

const internals = {
  storeSchema: Joi.object({
    tid: Joi.func().arity(2),
    find: Joi.func().arity(1),
    upsert: Joi.func().arity(2),
    remove: Joi.func().arity(1),
    close: Joi.func().arity(0)
  })
};

internals.validate = function(schema, data) {
  const validation = schema.validate(data);
  if (validation.error) {
    throw validation.error;
  }

  return validation.value;
};

internals.getStore = function(options) {
  if (typeof options.implementation === 'string') {
    if (options.implementation === 'mongo') {
      return new MongoTokenStore(options.url, options.name);
    }
  } else if (typeof options.implementation === 'function') {
    return internals.validate(
      internals.storeSchema,
      options.implementation(options.url, options.name)
    );
  }

  return internals.validate(internals.storeSchema, options.implementation);
};

internals.addSchemes = function(server, scheme, keys, common, options) {
  Object.keys(options).forEach((key) => {
    internals.addKey(keys, key);
    internals.addScheme(server, scheme, key, Object.assign(common, options[key]));
  });
};

internals.addScheme = function(server, scheme, name, options) {
  server.auth.scheme(name, scheme.get);
  server.auth.strategy(name, name, options);
};

internals.addKey = function(set, key) {
  if (set.has(key)) {
    throw new Error(`Auth scheme with name '${key}' already exists`);
  }

  return set.add(key);
};

// Define exports

exports.Log = Log;

exports.Token = Token;

exports.TokenStore = TokenStore;

exports.register = function(server, options, next) {
  // Validate passed options
  const settings = internals.validate(Schema, options);

  // Setup session scheme and strategy
  const name = settings.session.name || 'session';
  internals.addScheme(server, SessionScheme, name, settings.session);

  const store = internals.getStore(settings.store);
  const keys = new Set([name]);

  // Setup entity scheme and strategy
  if (settings.entity) {
    internals.addSchemes(server, EntityScheme, keys, { store }, settings.entity);
  }

  // Setup resource scheme and strategy
  if (settings.resource) {
    internals.addSchemes(server, ResourceScheme, keys, { store }, settings.resource);
  }

  // Set default strategy if any
  if (settings.default) {
    server.auth.default(settings.default);
  }

  return next();
};

/* eslint-disable global-require */
exports.register.attributes = {
  pkg: require('../package.json')
};
