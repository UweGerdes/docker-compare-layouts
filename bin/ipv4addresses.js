// Get IP for console message

'use strict';

const os = require('os');

module.exports = {
  get: () => { // jscs:ignore jsDoc
    const addresses = [];
    const interfaces = os.networkInterfaces();
    for (let k in interfaces) {
      if (interfaces.hasOwnProperty(k)) {
        for (let k2 in interfaces[k]) {
          if (interfaces[k].hasOwnProperty(k2)) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
              addresses.push(address.address);
            }
          }
        }
      }
    }
    return addresses;
  }
};
