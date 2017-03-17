'use strict';

// Load modules

const Boom = require('boom');
const Co = require('co');
const Hoek = require('hoek');
const OAuth2 = require('oauth').OAuth2;

const Log = require('../Log');
const Scheme = require('./Scheme');
const Token = require('../store/Token');
const Util = require('./Util');
const Wall = require('../index');

// Define exports

module.exports = class Resource extends Scheme {

  constructor(client, options) {
    super(options);
    this.client = client;
  }

  static implementation(server, options) {
    const client = new OAuth2(
      options.client.id,
      options.client.secret,
      '',
      options.provider.authorization_endpoint,
      options.provider.token_endpoint
    );

    client.useAuthorizationHeaderforGET(!options.provider.useQueryAuth);

    const strategy = new Resource(client, Hoek.cloneWithShallow(options, ['store']));
    Wall.Instance.addStrategy(strategy);

    return strategy;
  }

  doAuthenticate(request, reply) {
    const store = this.options.store;
    const user = Util.getUser(request);
    const tid = store.tid(user, this.options.client);

    return store.find(tid)
      .then((token) => {
        if (token) {
          return this.refresh(request, reply, token);
        }

        return this.authorize(request, reply);
      })
      .catch((err) => {
        Log.error(err);
        return reply(err);
      });
  }

  authorize(request, reply) {
    const authParams = this.options.authParams;
    if (!request.query.code) {
      const authorizationURL = this.client.getAuthorizeUrl(Object.assign({}, authParams, {
        response_type: 'code',
        state: Util.setState(request, this.options.client.id, authParams.state)
      }));

      if (this.options.initiate) {
        return reply.redirect(authorizationURL);
      }

      return reply(Boom.forbidden('Requested resource requires authorization', { authorizationURL }));
    }

    Hoek.assert(Util.getState(request, this.options.client.id) === request.query.state, 'State mismatch');

    return this.getToken(request.query.code, {
      redirect_uri: authParams.redirect_uri,
      grant_type: 'authorization_code'
    })
      .then((token) => this.store.upsert(this.store.prepare(Util.getUser(request), this.options.client, token)))
      .then((upserted) => this.append(request, reply, upserted));
  }

  refresh(request, reply, token) {
    if (token.expired()) {
      const store = this.options.store;
      const user = Util.getUser(request);
      const client = this.options.client;
      const self = this;

      return Co(function*() {
        const refreshed = yield self.token(token.refreshToken, { grant_type: 'refresh_token' });
        const upserted = yield store.upsert(store.prepare(user, client, Object.assign({}, token, refreshed)));

        return self.append(request, reply, upserted);
      });
    }

    return this.append(request, reply, token);
  }

  append(request, reply, token) {
    const auth = Hoek.clone(Util.getAuthentication(request));
    auth.credentials.resource = token;

    return Util.setAuthentication(request, reply, auth, true);
  }

  token(actor, params) {
    return new Promise((resolve, reject) => {
      this.client.getOAuthAccessToken(actor, params, (err, accessToken, refreshToken, raw) => {
        if (err) {
          return reject(err);
        }

        // Client library removes refresh token, so re-append it only when applicable
        if (refreshToken) {
          raw.refresh_token = refreshToken;
        }

        return resolve(new Token(raw));
      });
    });
  }
};
