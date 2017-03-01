'use strict';

// Load modules

const Co = require('co');
const Issuer = require('openid-client').Issuer;

const Log = require('../Log');
const SessionScheme = require('./SessionScheme');
const Util = require('./Util');
const Token = require('../store/Token');

// Declare internals

const internals = {
  clients: new Map()
};

internals.authenticate = function(request, reply) {
  const session = SessionScheme.getSession(request);
  const options = this.options;

  // Initialize sign-in

  if (!request.query.code) {
    return reply.redirect(internals.getAuthorizationURL(request, session, options.client, options.authParams));
  }

  // Authorization callback

  return Co(function*() {
    const rawToken = yield internals.getRawToken(request, session, options.client, options.authParams.redirect_uri);
    const userInfo = yield internals.clients.get(options.client.id).userinfo(rawToken);
    const token = new Token(rawToken);
    const credentials = yield internals.getCredentials(token, userInfo, options.credentials);
    yield internals.setToken(options.store, credentials.user, options.client, token);

    return { credentials };
  })
    .then((auth) => SessionScheme.setAuthentication(request, reply, auth))
    .catch((err) => {
      Log.error(err);
      return reply(err);
    });
};

internals.getAuthorizationURL = function(request, session, client, options) {
  const nonce = Util.setNonce(session, client.id, options.nonce);
  const state = Util.setState(request, session, client.id, options.state);
  const params = Object.assign({}, options, { nonce, state });
  const url = internals.clients.get(client.id).authorizationUrl(params);
  Log.info(`Authorization URL: ${url}`);

  return url;
};

internals.getRawToken = function(request, session, client, redirectURI) {
  return internals.clients.get(client.id).authorizationCallback(redirectURI, request.query, {
    nonce: Util.getNonce(session, client.id),
    state: Util.getState(session, client.id)
  });
};

internals.getCredentials = function(token, userInfo, callback) {
  if (callback) {
    return callback(token, userInfo);
  }

  return Promise.resolve({ user: userInfo });
};

internals.setToken = function(store, user, client, token) {
  return store.upsert(store.prepare(user, client, token));
};

// Define exports

exports.get = function(options) {
  const issuer = new Issuer(options.provider);
  internals.clients.set(options.client.id, new issuer.Client(options.client));

  return internals.authenticate;
};
