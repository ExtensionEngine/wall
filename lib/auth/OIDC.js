'use strict';

// Load modules

const Co = require('co');
const Hoek = require('hoek');

const Entity = require('./Entity');
const Log = require('../Log');
const Parameter = require('./Parameter');
const Token = require('../store/Token');
const Util = require('./Util');
const Wall = require('../index');

// Define exports

module.exports = class OIDC extends Entity {
  doAuthenticate(request, reply) {
    // Initialize sign-in

    if (!request.query.code) {
      return reply.redirect(this.authorizationURL(request));
    }

    // Authorization callback

    const self = this;

    return Co(function*() {
      let token = yield self.token(request, reply);
      if (!token) {
        return {}; // Something went wrong and response has been send
      }

      const userInfo = yield self.client.userinfo(token.accessToken);
      const credentials = yield self.credentials(token, userInfo, { name: self.name, tags: self.options.tags });
      Hoek.assert(credentials.user, 'Invalid credentials object, user is undefined');
      Hoek.assert(!credentials.token, 'Invalid credentials object, token is defined');

      const artifacts = { type: self.type, source: self.name, tags: self.options.tags };
      token = yield self.persist(credentials.user, token);

      return { credentials, artifacts, token };
    })
      .then(({ credentials, artifacts, token }) => {
        if (credentials && token) {
          Wall.Instance.emit('profile', { source: this.name, tags: this.options.tags, user: credentials.user, token });
          Util.setAuthentication(request, reply, { credentials, artifacts });
        }
      })
      .catch((err) => {
        Log.error(err);
        return reply(err);
      });
  }

  authorizationURL(request) {
    const client = this.options.client;
    const authParams = this.options.authParams;
    const nonce = Parameter.produce('nonce', request, client, authParams);
    const state = Parameter.produce('state', request, client, authParams);
    const params = Object.assign({}, authParams, { nonce, state });
    const url = this.client.authorizationUrl(params);
    Log.debug(`[${this.options.name}] authorization URL: ${url}`);

    return url;
  }

  token(request, reply) {
    const client = this.options.client;
    const authParams = this.options.authParams;
    const { redirect_uri: redirectUri } = authParams;
    const nonce = Parameter.consume('nonce', request, client, authParams);
    const state = Parameter.consume('state', request, client, authParams);
    if ((!nonce && authParams.nonce !== false) ||
        (!state && authParams.state !== false)) {
      Util.retryRedirect(request, reply, redirectUri);
      return Promise.resolve();
    }

    Parameter.wipe('nonce', request, client);
    Parameter.wipe('state', request, client);

    return this.client.authorizationCallback(redirectUri, request.query, { nonce, state })
      .then((raw) => new Token(raw));
  }

  credentials(token, userInfo, source) {
    const callback = this.options.credentials;
    if (callback) {
      return callback(token, userInfo, source);
    }

    return Promise.resolve({ user: userInfo });
  }
};
