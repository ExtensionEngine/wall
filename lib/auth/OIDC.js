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
      let token = yield self.token(request);
      const userInfo = yield self.client.userinfo(token.accessToken);
      const credentials = yield self.credentials(token, userInfo, { name: self.name, tags: self.options.tags });
      Hoek.assert(credentials.user, 'Invalid credentials object, user is undefined');
      Hoek.assert(!credentials.token, 'Invalid credentials object, token is defined');

      const artifacts = { type: self.type, source: self.name, tags: self.options.tags };
      token = yield self.persist(credentials.user, token);

      return { credentials, artifacts, token };
    })
      .then(({ credentials, artifacts, token }) => {
        Wall.Instance.emit('profile', { source: this.name, tags: this.options.tags, user: credentials.user, token });
        Util.setAuthentication(request, reply, { credentials, artifacts });
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

  credentials(token, userInfo, source) {
    const callback = this.options.credentials;
    if (callback) {
      return callback(token, userInfo, source);
    }

    return Promise.resolve({ user: userInfo });
  }
};
