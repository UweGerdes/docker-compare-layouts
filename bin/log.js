/**
 * @module server
 */
'use strict';

const chalk = require('chalk'),
  dateFormat = require('dateformat')
  ;

module.exports = {

  /**
   * print timestamp and message to console
   *
   * @param {string} msg - name
   */
  info: (msg) => {
    console.log('[' + chalk.gray(dateFormat(new Date(), 'HH:MM:ss')) + '] ' + msg);
  }
};
