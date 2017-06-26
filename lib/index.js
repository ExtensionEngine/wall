'use strict';

// Load modules

const Hoek = require('hoek');

const Entity = require('./auth/Entity');
const Instance = require('./Instance');
const Log = require('./Log');
const MongoStore = require('./store/Mongo');
const Resource = require('./auth/Resource');
const Schema = require('./Schema');
const Session = require('./auth/Session');
const Token = require('./store/Token');
const Store = require('./store/Store');

// Decalre internals

const internals = {};

internals.validate = function(schema, data) {
  const validation = schema.validate(data);
  if (validation.error) {
    throw validation.error;
  }

  return validation.value;
};

internals.getStore = function(options) {
  const number = exports.register.attributes.pkg.version;
  if (typeof options.implementation === 'string') {
    if (options.implementation === 'mongo') {
      return new MongoStore(number, options);
    }
  } else if (typeof options.implementation === 'function') {
    return internals.validate(Store.schema, options.implementation(number, options));
  }

  return internals.validate(Store.schema, options.implementation);
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

internals.addLogoutHandler = function(server, settings) {
  const route = {
    method: settings.session.logout.method,
    path: settings.session.logout.uri,
    handler(request, reply) {
      let outcome;
      if (settings.session.logout.finalize) {
        outcome = settings.session.logout.finalize(request, reply);
      } else {
        outcome = Promise.resolve();
      }

      request.yar.reset();
      outcome.then((target) => reply.redirect(target || settings.session.loginForm));
    }
  };

  if (settings.session.logout.auth) {
    route.config = { auth: settings.session.logout.auth };
  }

  server.route(route);
};

// Define exports

exports.Log = Log;

exports.Store = Store;

exports.Token = Token;

exports.standalone = function(options) {
  const isStandalone = exports.Instance && exports.Instance.isStandalone;
  Hoek.assert(!exports.Instance || isStandalone, 'Already using Wall in a plugin mode');

  const cache = new Map();
  const serverMock = {
    auth: {
      default() {},
      scheme(name, implementation) {
        cache.set(name, implementation);
      },
      strategy(name, type, settings) {
        cache.get(type)(null, settings);
      }
    }
  };

  // Check if there is an instance in a standalone mode
  if (isStandalone) {
    Log.warn('Wall instance is already used in standalone mode, returning existing instance');
    return exports.Instance;
  }

  return exports.register(serverMock, options, () => {
    exports.Instance.isStandalone = true;
    return exports.Instance;
  });
};

exports.register = function(server, options, next) {
  // Validate passed options and create a store
  const settings = internals.validate(Schema, options);
  const store = internals.getStore(settings.store);

  // Create and export instance
  Hoek.assert(!exports.Instance, 'Already using Wall in a standalone mode');
  exports.Instance = new Instance(store);

  // Setup session scheme and strategy
  const name = settings.session.name || 'session';
  server.auth.scheme('session', Session.implementation);
  internals.addStrategy(server, name, 'session', settings.session);

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

  // Register logout handler
  internals.addLogoutHandler(server, settings);

  return next();
};

/* eslint-disable global-require */
exports.register.attributes = {
  pkg: require('../package.json')
};
