// Load modules

const Client = require('mongodb').MongoClient;
const Co = require('co');

const Log = require('../Log');
const Token = require('./Token');
const TokenStore = require('./TokenStore');

// Declare internals

const internals = {};

internals.wrap = function(token) {
  return token ? new Token(token) : null;
};

// Define exports

module.exports = class extends TokenStore {

  constructor(url, name) {
    super();
    Co(function*() {
      const db = yield typeof url === 'string' ? Client.connect(url) : Promise.resolve(url);
      const collection = yield db.createCollection(name);
      yield collection.createIndex('tid', { unique: true });

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

  find(tid) {
    return this.collection.findOne({ tid }).then(internals.wrap);
  }

  upsert(tid, data) {
    const self = this;
    return Co(function*() {
      const validated = yield self.validate(data);
      const upserted = yield self.collection.findOneAndUpdate({ tid }, {
        $setOnInsert: {
          createdAt: new Date()
        },
        $set: validated,
        $currentDate: {
          updateAt: true
        }
      }, {
        returnOriginal: false,
        upsert: true
      });

      return internals.wrap(upserted);
    });
  }

  remove(tid) {
    return this.collection.removeOne({ tid });
  }

  close() {
    this.db.close();
  }
};
