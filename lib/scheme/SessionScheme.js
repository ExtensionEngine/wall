'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');

const Log = require('../Log');

// Declare internals

const internals = {
  AUTH_KEY: 'auth',
  loginForm: null
};

internals.authenticate = function(request, reply) {
  if (internals.isAuthenticated(request)) {
    internals.sendUnauthorized(request, reply);
  }

  return internals.setAuthentication(request, reply);
};

// Define exports

exports.getSession = function(request) {
  return request.yar;
};

exports.getAuthentication = function(request) {
  return this.getSession(request).get(internals.AUTH_KEY);
};

exports.isAuthenticated = internals.isAuthenticated = function(request) {
  const auth = this.getAuthentication(request);
  return auth && auth.credentials && auth.credentials.user;
};

exports.getUser = function(request) {
  return this.getAuthentication(request).credentials.user;
};

exports.setAuthentication = internals.setAuthentication = function(request, reply, auth, temp) {
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

  Log.info(`Setting credentials: ${JSON.stringify(current.credentials)}`);

  return reply.continue(current);
};

exports.sendUnauthorized = internals.sendUnauthorized = function(request, reply) {
  return reply(Boom.unauthorized('Unknown entity', 'Session', {
    location: internals.loginForm
  }));
};

exports.get = function(server, options) {
  internals.loginForm = options.loginForm;

  return {
    options,
    authenticate: internals.authenticate
  };
};
