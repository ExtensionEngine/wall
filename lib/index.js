'use strict';

// Load modules

const Joi = require('joi');

const Entity = require('./auth/Entity');
const Instance = require('./Instance');
const Log = require('./Log');
const MongoTokenStore = require('./store/MongoTokenStore');
const Resource = require('./auth/Resource');
const Schema = require('./Schema');
const Session = require('./auth/Session');
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

internals.addStrategies = function(server, type, common, options) {
  Object.keys(options).forEach((key) => {
    const settings = options[key];
    internals.addStrategy(server, settings.name || key, type, Object.assign({}, common, settings));
  });
};

internals.addStrategy = function(server, name, type, options) {
  const settings = Object.assign({ name, type }, options);
  server.auth.strategy(name, type, settings);
};

// Define exports

exports.Log = Log;

exports.Token = Token;

exports.TokenStore = TokenStore;

exports.register = function(server, options, next) {
  // Validate passed options
  const settings = internals.validate(Schema, options);

  // Create and export instance
  exports.Instance = new Instance(store);

  // Setup session scheme and strategy
  const name = settings.session.name || 'session';
  server.auth.scheme('session', Session.implementation);
  internals.addStrategy(server, name, 'session', settings.session);

  const store = internals.getStore(settings.store);
  const common = {
    store,
    loginForm: settings.session.loginForm
  };

  // Setup entity scheme and strategy
  if (settings.entity) {
    server.auth.scheme('entity', Entity.implementation);
    internals.addStrategies(server, 'entity', common, settings.entity);
  }

  // Setup resource scheme and strategy
  if (settings.resource) {
    server.auth.scheme('resource', Resource.implementation);
    internals.addStrategies(server, 'resource', common, settings.resource);
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
