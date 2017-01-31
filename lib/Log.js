'use strict';

// Define exports

module.exports = {
  logger: null,
  error(obj) {
    this.log('error', obj);
  },
  warn(obj) {
    this.log('warn', obj);
  },
  info(obj) {
    this.log('info', obj);
  },
  debug(obj) {
    this.log('debug', obj);
  },
  log(level, obj) {
    if (this.logger) {
      this.logger[level](obj);
    }
  }
};
