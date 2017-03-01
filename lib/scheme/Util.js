// Load modules

const Crypto = require('crypto');

const Hoek = require('hoek');

// Declare internals

const internals = {};

internals.nonceKey = function(prefix) {
  return `${prefix}:nonce`;
};

internals.stateKey = function(prefix) {
  return `${prefix}:state`;
};

// Define exports

exports.getNonce = function(session, prefix) {
  return session.get(internals.nonceKey(prefix), true);
};

exports.setNonce = function(session, prefix, neglect) {
  if (neglect === false) {
    return;
  }

  return session.set(internals.nonceKey(prefix), Crypto.randomBytes(24).toString('hex'));
};

exports.getState = function(session, prefix) {
  return session.get(internals.stateKey(prefix), true);
};

exports.setState = function(request, session, prefix, hint) {
  if (hint === false) {
    return;
  }

  const state = typeof hint === 'function' ? hint(request) : Hoek.base64urlEncode(Crypto.randomBytes(40));
  return session.set(internals.stateKey(prefix), state);
};
