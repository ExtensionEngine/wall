'use strict';

// Load modules

const Boom = require('boom');

const Util = require('./Util');

// Define exports

module.exports = class Scheme {
  constructor(options) {
    if (new.target === Scheme) {
      throw new Error('Cannot instantiate class "Scheme" directly');
    }

    if (this.doAuthenticate === undefined) {
      throw new Error('Method "doAuthenticate" not implemented');
    }

    this.type = options.type; // Represents the name of scheme
    this.name = options.name; // The name of strategy
    this.options = options;
  }

  static implementation(server, options) {
    //   Actual logic to be provided by child class
    if (this === Scheme) {
      throw new Error('Can not call static method "implementation"');
    } else if (this.foo === Scheme.foo) {
      throw new Error('Static method "implementation" not implemented');
    } else {
      throw new Error('Do not call static method "implementation" from child');
    }
  }

  authenticate(request, reply) {
    if (!Util.isAuthenticated(request)) {
      const headers = request.headers;
      if ((typeof this.options.redirect === 'boolean' && !this.options.redirect) ||
        headers['x-requested-with'] === 'XMLHttpRequest' ||
        (headers['accept'] && headers['accept'].includes('application/json'))) {
        return this.sendUnauthorized(request, reply);
      }

      return reply.redirect(this.options.loginForm);
    }

    return this.doAuthenticate(request, reply);
  }

  /* doAuthenticate(request, reply) {
    Actual logic to be provided by child class
  } */

  sendUnauthorized(request, reply) {
    return reply(Boom.unauthorized('Unknown entity', 'Session', {
      location: this.options.loginForm
    }));
  }

  persist(user, token) {
    return this.options.store.prepare(user, this.options.client, this.name, token)
      .then((prepared) => prepared.upsert());
  }
};
