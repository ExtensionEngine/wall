// Load modules

const QueryString = require('querystring');
const Url = require('url');

const Boom = require('boom');
const Hoek = require('hoek');

// Declare internals

const internals = { AUTH_KEY: 'auth' };

// Define exports

exports.getSession = function(request) {
  return request.yar;
};

exports.getAuthentication = function(request) {
  return this.getSession(request).get(internals.AUTH_KEY);
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

exports.retryRedirect = function(request, reply, redirectUri) {
  if (request.query.try) {
    return reply(Boom.badImplementation('Missing required request token'));
  }

  const query = Object.assign({}, request.query, { try: 1 });
  const separator = Url.parse(redirectUri).query ? '&' : '?';
  const refreshUri = `${redirectUri}${separator}${QueryString.stringify(query)}`;

  return reply(`<html><head><meta http-equiv="refresh" content="0;url='${refreshUri}'"></head><body></body></html>`);
};
