'use strict';

// Load modules

const Hoek = require('hoek');

const Scheme = require('./Scheme');
const Util = require('./Util');
const Wall = require('../index');

// Define exports

module.exports = class Session extends Scheme {

  static implementation(server, options) {
    const strategy = new Session(Hoek.clone(options));
    Wall.Instance.add(strategy);

    return strategy;
  }

  doAuthenticate(request, reply) {
    return Util.setAuthentication(request, reply);
  }
};
