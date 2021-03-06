'use strict';

// Load modules

const Url = require('url');

const Boom = require('boom');
const Co = require('co');
const Hoek = require('hoek');
const OAuth2 = require('oauth').OAuth2;

const Log = require('../Log');
const Parameter = require('./Parameter');
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
    Wall.Instance.add(strategy);

    return strategy;
  }

  authenticate(request, reply) {
    const { redirect_uri: redirectUri } = this.options.authParams;
    const { pathname } = Url.parse(redirectUri);
    if (request.path === pathname) { // A callback invocation so pass it directly to handle CORS
      return Promise.resolve(this.authorize(request, reply))
        .catch((err) => {
          Log.error(err);
          return reply(err);
        });
    }

    return super.authenticate(request, reply);
  }

  doAuthenticate(request, reply) {
    const store = this.options.store;
    const user = Util.getUser(request);

    return store.id(user, this.options.client).find()
      .then((token) => {
        if (token) {
          return this.advance(request, reply, token);
        }

        return this.authorize(request, reply);
      })
      .catch((err) => {
        Log.error(err);
        return reply(err);
      });
  }

  authorize(request, reply) {
    const { authParams, client: clientOptions } = this.options;
    if (!request.query.code) {
      const authorizationURL = this.client.getAuthorizeUrl(Object.assign({}, authParams, {
        response_type: 'code',
        state: Parameter.produce('state', request, clientOptions, authParams)
      }));

      const routeConf = request.route.settings.plugins.wall;
      if ((routeConf && routeConf.initiate === true) ||
          ((!routeConf || (routeConf && routeConf.initiate !== false)) && this.options.initiate)) {
        return reply.redirect(authorizationURL);
      }

      return reply(Boom.forbidden('Requested resource requires authorization', { authorizationURL }));
    }

    const state = Parameter.consume('state', request, clientOptions, authParams);
    if (!state && authParams.state !== false) {
      Util.retryRedirect(request, reply, authParams.redirect_uri);
      return undefined;
    }

    Parameter.wipe('state', request, clientOptions);
    Hoek.assert(state === request.query.state, 'State mismatch');

    const user = Util.getUser(request);

    return this.token(request.query.code, {
      redirect_uri: authParams.redirect_uri,
      grant_type: 'authorization_code'
    })
      .then((token) => this.persist(user, token))
      .then((upserted) => {
        Wall.Instance.emit('authorization', { source: this.name, tags: this.options.tags, user, token: upserted });
        return this.append(request, reply, upserted);
      });
  }

  refresh(user, token) {
    const self = this;

    return Co(function*() {
      const refreshed = yield self.token(token.refreshToken, { grant_type: 'refresh_token' });
      const details = Object.assign({}, token, refreshed);
      const upserted = yield self.persist(user, details);

      Wall.Instance.emit('refresh', { source: self.name, tags: self.options.tags, user, token: upserted });

      return upserted;
    });
  }

  advance(request, reply, token) {
    if (token.expired()) {
      const user = Util.getUser(request);
      return this.refresh(user, token)
        .then((refreshed) => this.append(request, reply, refreshed));
    }

    return this.append(request, reply, token);
  }

  append(request, reply, token) {
    const auth = Hoek.clone(Util.getAuthentication(request));
    auth.credentials.token = token;

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
