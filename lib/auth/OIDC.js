'use strict';

// Load modules

const Co = require('co');
const Hoek = require('hoek');

const Entity = require('./Entity');
const Log = require('../Log');
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
      const token = yield self.token(request);
      const userInfo = yield self.client.userinfo(token.accessToken);
      const credentials = yield self.credentials(token, userInfo);
      Hoek.assert(credentials.user, 'Invalid credentials object, user is undefined');
      Hoek.assert(!credentials.token, 'Invalid credentials object, token is defined');

      yield self.persist(credentials.user, token);

      return { credentials };
    })
      .then((auth) => {
        Wall.Instance.emmit('profile', { source: this.options.name, user: auth.credentials.user });
        Util.setAuthentication(request, reply, auth);
      })
      .catch((err) => {
        Log.error(err);
        return reply(err);
      });
  }

  authorizationURL(request) {
    const authParams = this.options.authParams;
    const nonce = Util.setNonce(request, this.options.client.id, authParams.nonce);
    const state = Util.setState(request, this.options.client.id, authParams.state);
    const params = Object.assign({}, authParams, { nonce, state });
    const url = this.client.authorizationUrl(params);
    Log.debug(`[${this.options.name}] authorization URL: ${url}`);

    return url;
  }

  token(request) {
    return this.client.authorizationCallback(this.options.authParams.redirect_uri, request.query, {
      nonce: Util.getNonce(request, this.options.client.id),
      state: Util.getState(request, this.options.client.id)
    }).then((raw) => new Token(raw));
  }

  credentials(token, userInfo) {
    const callback = this.options.credentials;
    if (callback) {
      return callback(token, userInfo);
    }

    return Promise.resolve({ user: userInfo });
  }

  persist(user, token) {
    const store = this.options.store;
    return store.upsert(store.prepare(user, this.options.client, token));
  }
};