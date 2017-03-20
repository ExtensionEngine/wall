// Load modules

const Client = require('mongodb').MongoClient;
const Co = require('co');
const Homefront = require('homefront');

const Log = require('../Log');
const Store = require('./Store');
const Token = require('./Token');

// Declare internals

const internals = {};

internals.wrap = function(token) {
  if (Array.isArray(token)) {
    return token.map((el) => new Token(el.details));
  }

  return token ? new Token(token.details) : null;
};

// Define exports

module.exports = class extends Store {

  constructor(url, name) {
    super();
    Co(function*() {
      const db = yield typeof url === 'string' ? Client.connect(url) : Promise.resolve(url);
      const collection = yield db.createCollection(name);

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

  // Putted in separate method to handle V8's 'super' keyword bug
  validate(data) {
    return super.validate(data);
  }

  list(user) {
    return this.collection.find({ user: user.sub }).toArray().then(internals.wrap);
  }

  find(id) {
    return this.collection.findOne({ _id: id }).then(internals.wrap);
  }

  exists(id) {
    return this.collection.count({ _id: id }).then((count) => count === 1);
  }

  upsert(id, data) {
    const _id = arguments.length === 1 ? id.id : id;
    const document = arguments.length === 1 ? id : data;
    const self = this;

    delete document.id;

    return Co(function*() {
      const validated = yield self.validate(document);
      const upserted = yield self.collection.findOneAndUpdate({ _id }, {
        $setOnInsert: { createdAt: new Date() },
        $set: Homefront.flatten(validated),
        $currentDate: { updateAt: true }
      }, {
        returnOriginal: false,
        upsert: true
      });

      return internals.wrap(upserted.value);
    });
  }

  remove(id) {
    return this.collection.removeOne({ _id: id });
  }

  close() {
    this.db.close();
  }
};