// Load modules

const Crypto = require('crypto');

// Declare internals

const internals = {};

internals.nonceKey = function(prefix) {
  return `${prefix}:nonce`;
};

internals.stateKey = function(prefix) {
  return `${prefix}:state`;
};

// Define exports

exports.nonce = function(session, prefix, read) {
  if (!read) {
    return session.set(internals.nonceKey(prefix), Crypto.randomBytes(16).toString('hex'));
  }

  return session.get(internals.nonceKey(prefix), true);
};

exports.state = function(session, prefix, read) {
  if (!read || typeof read === 'string') {
    const state = typeof read === 'string' ? read : Crypto.randomBytes(20).toString('hex');
    return session.set(internals.stateKey(prefix), state);
  }

  return session.get(internals.stateKey(prefix), true);
};
