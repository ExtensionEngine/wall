'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');
const OAuth2 = require('oauth').OAuth2;

const Log = require('../Log');
const SessionScheme = require('./SessionScheme');
const Token = require('../store/Token');
const Util = require('./Util');

// Declare internals

const internals = {
  clients: new Map()
};

internals.authenticate = function(request, reply) {
  if (!SessionScheme.isAuthenticated(request)) {
    return SessionScheme.sendUnauthorized(request, reply);
  }

  const session = SessionScheme.getSession(request);
  const options = this.options;
  const store = options.store;
  const client = options.client;
  const user = SessionScheme.getUser(request);

  return store.find(store.tid(user, client))
    .then((token) => {
      if (token) {
        return internals.setAuthorization(request, reply, session, store, client, token);
      }

      return internals.getAuthorization(request, reply, session, store, user, client, options.authParams);
    })
    .catch((err) => {
      Log.error(err);
      return reply(err);
    });
};

internals.getAuthorization = function(request, reply, session, store, user, client, options) {
  if (!request.query.code) {
    const autrorizationURL = internals.clients.get(client.id).getAuthorizeUrl(Object.assign({}, options, {
      response_type: 'code',
      state: Util.state(session, client.id, options.state ? options.state(request) : false)
    }));

    return reply(Boom.forbidden('Requested resource requires authorization', { autrorizationURL }));
  }

  Hoek.assert(Util.state(session, client.id, true) === request.query.state, 'State mismatch');

  return internals.getToken(request.query.code, client, {
    redirect_uri: options.redirect_uri,
    grant_type: 'authorization_code'
  })
    .then((token) => {
      token.user = user.sub;
      token.client = client.id;
      token.tid = store.tid(user, client);

      return store.upsert(token.tid, token);
    })
    .then((upserted) => internals.setCredentials(request, reply, upserted));
};

internals.setAuthorization = function(request, reply, session, store, client, token) {
  if (token.expired()) {
    return internals.getToken(token.refreshToken, client, { grant_type: 'refresh_token' })
      .then((refreshed) => store.upsert(token.tid, Object.assign({}, token, refreshed)))
      .then((upserted) => internals.setCredentials(reply, session, upserted));
  }

  return internals.setCredentials(request, reply, token);
};

internals.setCredentials = function(request, reply, token) {
  const auth = Hoek.clone(SessionScheme.getAuthentication(request));
  auth.credentials.resource = token;

  return SessionScheme.setAuthentication(request, reply, auth, true);
};

internals.getToken = function(actor, client, params) {
  return new Promise((resolve, reject) => {
    internals.clients.get(client.id)
      .getOAuthAccessToken(actor, params, (err, accessToken, refreshToken, raw) => {
        if (err) {
          return reject(err);
        }

        return resolve(new Token(Object.assign(raw, { refresh_token: refreshToken })));
      });
  });
};

// Degine exports

exports.get = function(server, options) {
  const client = new OAuth2(
    options.client.id,
    options.client.secret,
    '',
    options.provider.authorization_endpoint,
    options.provider.token_endpoint
  );

  client.useAuthorizationHeaderforGET(!options.provider.useQueryAuth);
  internals.clients.set(options.client.id, client);

  return {
    options,
    authenticate: internals.authenticate
  };
};
