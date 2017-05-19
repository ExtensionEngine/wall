'use strict';

// Load modules

const Joi = require('joi');

// Declare internals

const internals = {
  entity: {}
};

// Base provider schema
internals.provider = Joi.object({
  authorization_endpoint: Joi.string().uri().required(),
  token_endpoint: Joi.string().uri().required(),
  token_revocation_endpoint: Joi.string().uri().optional(),
  headers: Joi.object().optional()
});

// Base client schema
internals.client = Joi.object({
  id: Joi.string().required(),
  secret: Joi.string().required()
})
  .rename('client_id', 'id', { alias: true })
  .rename('client_secret', 'secret', { alias: true })
  .pattern(/^(client_id|client_secret)$/, Joi.string());

// Base authorization endpoint parameters schema
internals.authParams = Joi.object({
  scope: Joi.string().required(),
  redirect_uri: Joi.string().uri().required(),
  state: Joi.alternatives().try(Joi.func(), Joi.boolean()).default(true).optional()
});

// Base entity/resource schema
internals.er = Joi.object({
  name: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

// OpenID Connect schema
internals.entity.oidc = internals.er.keys({
  protocol: Joi.string().valid('oidc').required(),
  resource: Joi.boolean().default(false).optional(),
  provider: internals.provider.keys({
    issuer: Joi.string().uri().required(),
    userinfo_endpoint: Joi.string().uri().required(),
    jwks_uri: Joi.string().uri().optional()
  }).when('resource', {
    is: true,
    then: Joi.object({ useQueryAuth: Joi.boolean().default(true).optional() }),
    otherwise: Joi.object({ useQueryAuth: Joi.forbidden() })
  }).required(),
  client: internals.client.keys({
    grant_types: Joi.array().items(Joi.string()).required(),
    id_token_signed_response_alg: Joi.string().optional(),
    clock_tolerance: Joi.number().integer().optional()
  }).required(),
  authParams: internals.authParams.keys({
    nonce: Joi.boolean().default(true).optional()
  }).required(),
  credentials: Joi.func().optional()
});

// Resource schema
internals.resource = Joi.object({
  redirect: Joi.boolean().default(false).optional(),
  initiate: Joi.boolean().default(false).optional(),
  provider: internals.provider.keys({
    useQueryAuth: Joi.boolean().default(true).optional()
  }).required(),
  client: internals.client.required(),
  authParams: internals.authParams.pattern(/^(\w)+$/, [Joi.string(), Joi.boolean()]).required()
});

// Define exports

module.exports = Joi.object({
  entity: Joi.object().pattern(/^(\w)+$/, internals.entity.oidc).optional(),
  resource: Joi.object().pattern(/^(\w)+$/, internals.resource).optional(),
  session: Joi.object({
    name: Joi.string().optional(),
    redirect: Joi.boolean().default(false).optional(),
    loginForm: Joi.string().uri({ allowRelative: true }).required()
  }).required(),
  store: Joi.object({
    implementation: Joi.alternatives().try(Joi.string().valid('mongo'), Joi.func(), Joi.object()).required(),
    url: Joi.string().optional().when('implementation', {
      is: Joi.string(),
      then: Joi.required()
    }),
    name: Joi.string().optional().when('implementation', {
      is: Joi.string(),
      then: Joi.required()
    })
  }).optional()
    .when('entity', { is: Joi.object(), then: Joi.required() })
    .when('resource', { is: Joi.object(), then: Joi.required() }),
  default: Joi.string().optional()
});
