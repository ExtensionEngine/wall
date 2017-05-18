'use strict';

// Load modules

const Joi = require('joi');

// Declare internals

const internals = {
  entity: {}
};

// Base provider schema
internals.provider = Joi.object({
  authorization_endpoint: Joi.string().uri(),
  token_endpoint: Joi.string().uri(),
  token_revocation_endpoint: Joi.string().uri().optional(),
  headers: Joi.object().optional()
});

// Base client schema
internals.client = Joi.object({
  id: Joi.string(),
  secret: Joi.string()
})
  .rename('client_id', 'id', { alias: true })
  .rename('client_secret', 'secret', { alias: true })
  .pattern(/^(client_id|client_secret)$/, Joi.string());

// Base authorization endpoint parameters schema
internals.authParams = Joi.object({
  scope: Joi.string(),
  redirect_uri: Joi.string().uri(),
  state: [Joi.func(), Joi.boolean().default(true)]
});

// Base entity/resource schema
internals.er = Joi.object({
  name: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

// OpenID Connect schema
internals.entity.oidc = internals.er.keys({
  protocol: Joi.string().valid('oidc'),
  resource: Joi.boolean().default(false),
  provider: internals.provider.keys({
    issuer: Joi.string().uri(),
    userinfo_endpoint: Joi.string().uri(),
    jwks_uri: Joi.string().uri()
  }).when('resource', {
    is: true,
    then: Joi.object({ useQueryAuth: Joi.boolean().default(true) }),
    otherwise: Joi.object({ useQueryAuth: Joi.forbidden() })
  }),
  client: internals.client.keys({
    grant_types: Joi.array().items(Joi.string()),
    id_token_signed_response_alg: Joi.string().optional(),
    clock_tolerance: Joi.number().integer().optional()
  }),
  authParams: internals.authParams.keys({
    nonce: Joi.boolean().default(true)
  }),
  credentials: Joi.func().optional()
});

// Resource schema
internals.resource = Joi.object({
  redirect: Joi.boolean().default(false),
  initiate: Joi.boolean().default(false),
  provider: internals.provider.keys({
    useQueryAuth: Joi.boolean().default(true)
  }),
  client: internals.client,
  authParams: internals.authParams.pattern(/^(\w)+$/, [Joi.string(), Joi.boolean()])
});

// Define exports

module.exports = Joi.object({
  entity: Joi.object().optional().pattern(/^(\w)+$/, internals.entity.oidc),
  resource: Joi.object().optional().pattern(/^(\w)+$/, internals.resource),
  session: Joi.object({
    name: Joi.string().optional(),
    redirect: Joi.boolean().optional(),
    loginForm: Joi.string().uri({ allowRelative: true })
  }),
  store: Joi.object({
    implementation: [Joi.string().valid('mongo'), Joi.func(), Joi.object()],
    url: Joi.string().optional().when('implementation', {
      is: Joi.string(),
      then: Joi.required()
    }),
    name: Joi.string().optional().when('implementation', {
      is: Joi.string(),
      then: Joi.required()
    })
  }),
  default: Joi.string().optional()
});
