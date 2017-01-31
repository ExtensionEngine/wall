'use strict';

// Load modules

const OIDCEntity = require('./OIDCEntity');
const SessionScheme = require('./SessionScheme');

// Define exports

exports.get = function(server, options) {
  let implementation;
  if (options.protocol === 'oidc') {
    implementation = OIDCEntity.get(options);
  }

  return {
    options,
    authenticate(request, reply) {
      if (SessionScheme.isAuthenticated(request)) {
        return SessionScheme.setAuthentication(request, reply);
      }

      return implementation.call(this, request, reply);
    }
  };
};
