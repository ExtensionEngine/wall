// Load modules

const Crypto = require('crypto');

const Hoek = require('hoek');

// Declare internals

const internals = { AUTH_KEY: 'auth' };

internals.nonceKey = function(prefix) {
  return `${prefix}:nonce`;
};

internals.stateKey = function(prefix) {
  return `${prefix}:state`;
};

// Define exports

exports.getSession = function(request) {
  return request.yar;
};

exports.getAuthentication = function(request) {
  return this.getSession(request).get(internals.AUTH_KEY);
};

exports.getNonce = function(request, prefix) {
  return this.getSession(request).get(internals.nonceKey(prefix), true);
};

exports.getState = function(request, prefix) {
  return this.getSession(request).get(internals.stateKey(prefix), true);
};

exports.getUser = function(request) {
  return this.getAuthentication(request).credentials.user;
};

exports.isAuthenticated = function(request) {
  const auth = this.getAuthentication(request);
  return auth && auth.credentials && auth.credentials.user;
};

exports.setAuthentication = function(request, reply, auth, temp) {
  const session = this.getSession(request);
  const stored = this.getAuthentication(request);

  Hoek.assert(stored || auth, 'No authentication to set');

  let current = stored;
  if (!stored && auth) {
    current = auth;
    session.set(internals.AUTH_KEY, auth);
  } else if (stored && auth && !Hoek.deepEqual(stored, auth, { prototype: false })) {
    current = auth;
    if (!temp) {
      session.touch();
    }
  }

  return reply.continue(current);
};

exports.setNonce = function(request, prefix, neglect) {
  if (neglect === false) {
    return;
  }

  return this.getSession(request).set(internals.nonceKey(prefix), Crypto.randomBytes(24).toString('hex'));
};

exports.setState = function(request, prefix, hint) {
  if (hint === false) {
    return;
  }

  const state = typeof hint === 'function' ? hint(request) : Hoek.base64urlEncode(Crypto.randomBytes(40));
  return this.getSession(request).set(internals.stateKey(prefix), state);
};
