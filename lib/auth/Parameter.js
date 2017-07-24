'use strict';

// Load modules

const Crypto = require('crypto');

const Hoek = require('hoek');

const Util = require('./Util');

// Declare internals

const internals = {
  has: Object.prototype.hasOwnProperty,
  parameters: {
    nonce: {
      length: 24,
      encoding: 'hex'
    },
    state: {
      length: 48,
      encoding: 'base64UrlSafe'
    }
  }
};

internals.assert = function(name) {
  const supportedNames = Object.keys(internals.parameters);
  Hoek.assert(supportedNames.includes(name), `Unknown parameter ${name}`);
};

internals.generateKey = function(name, client) {
  return `${name}#${client.id}`;
};

internals.generateValue = function(name) {
  const { length, encoding } = internals.parameters[name];
  const random = Crypto.randomBytes(length);
  if (encoding === 'base64UrlSafe') {
    return Hoek.base64urlEncode(random);
  }

  return random.toString(encoding);
};

// Define exports

exports.produce = function(name, request, client, options) {
  internals.assert(name);

  const hint = options[name];
  if (hint === false) {
    return;
  }

  const key = internals.generateKey(name, client);
  const value = typeof hint === 'function' ? hint(request) : internals.generateValue(name);
  const session = Util.getSession(request);

  return session.set(key, value);
};

exports.consume = function(name, request, client, options) {
  internals.assert(name);

  const hint = options[name];
  const query = request.query;
  const sentValue = query[name];
  if (hint === false) {
    // In a case where we don't send the parameter use value sent from provider, if exists
    return internals.has.call(query, name) ? sentValue : undefined;
  }

  const key = internals.generateKey(name, client);
  const session = Util.getSession(request);

  return session.get(key);
};

exports.wipe = function(name, request, client) {
  const key = internals.generateKey(name, client);
  const session = Util.getSession(request);

  session.clear(key);
};
