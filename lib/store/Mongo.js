// Load modules

const Binary = require('mongodb').Binary;
const Client = require('mongodb').MongoClient;
const Co = require('co');
const Homefront = require('homefront');

const Log = require('../Log');
const Store = require('./Store');

// Declare internals

const internals = {};

internals.toBinary = function(value, encoding = 'hex') {
  return new Binary(Buffer.from(value, encoding));
};

// Define exports

module.exports = class extends Store {
  constructor(number, { url, name, userKey }) {
    super(number, userKey);
    Co(function*() {
      const db = yield typeof url === 'string' ? Client.connect(url) : Promise.resolve(url);
      const collection = yield db.createCollection(name);
      yield collection.createIndex('user', { w: 1 });

      return { db, collection };
    })
      .then((result) => {
        this.db = result.db;
        this.collection = result.collection;
        Log.info('Successfully connected to mongodb token store');
      })
      .catch((err) => {
        Log.error('Failed to create mongo token store');
        Log.error(err);
      });
  }

  list(user) {
    return this.collection.find({ user: user.sub }).toArray().then((tokens) => this.wrap(tokens));
  }

  find(id) {
    return this.collection.findOne({ _id: internals.toBinary(id) }).then((token) => this.wrap(token));
  }

  exists(id) {
    return this.collection.count({ _id: internals.toBinary(id) }).then((count) => count === 1);
  }

  upsert(id, data) {
    const _id = internals.toBinary(arguments.length === 1 ? id.id : id);
    const document = arguments.length === 1 ? id : data;
    const self = this;

    return Co(function*() {
      const validated = yield self.validate(document);
      delete validated.id; // Remove id to avoid duplication, will store as _id inside mongo
      const upserted = yield self.collection.findOneAndUpdate({ _id }, {
        $setOnInsert: { createdAt: new Date() },
        $set: Homefront.flatten(validated),
        $currentDate: { updateAt: true }
      }, {
        returnOriginal: false,
        upsert: true
      });

      return self.wrap(upserted.value);
    });
  }

  remove(id) {
    return this.collection.removeOne({ _id: internals.toBinary(id) });
  }

  close() {
    this.db.close();
  }
};
