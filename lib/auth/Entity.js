'use strict';

// Load modules

const Hoek = require('hoek');
const Issuer = require('openid-client').Issuer;

const Resource = require('./Resource');
const Scheme = require('./Scheme');
const Util = require('./Util');
const Wall = require('../index');

// Define exports

module.exports = class Entity extends Scheme {

  constructor(client, resource, options) {
    super(options);
    this.client = client;
    this.resource = resource;
  }

  static implementation(server, options) {
    const settings = Hoek.cloneWithShallow(options, ['store']);
    if (settings.protocol === 'oidc') {
      const issuer = new Issuer(settings.provider);
      let resource;
      if (settings.resource) {
        resource = Resource.implementation(server, Object.assign({}, settings, {
          type: 'resource:INTERNAL',
          name: `${settings.name}:INTERNAL`
        }));
      }

      const OIDC = require('./OIDC'); // eslint-disable-line global-require
      const strategy = new OIDC(new issuer.Client(settings.client), resource, settings);
      Wall.Instance.add(strategy);

      return strategy;
    }
  }

  authenticate(request, reply) {
    if (Util.isAuthenticated(request)) {
      if (this.resource) {
        return this.resource.authenticate(request, reply);
      }
      return Util.setAuthentication(request, reply);
    }

    return this.doAuthenticate(request, reply);
  }
};
