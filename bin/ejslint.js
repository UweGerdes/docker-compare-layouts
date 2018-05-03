/**
 * @module lint
 */
'use strict';

const fs = require('fs'),
  glob = require('glob'),
  jshint = require('jshint').JSHINT
  ;

/**
* #### Lint ejs files
*
* validate ejs files
* - replace `<%=`, `<%-` tags with output = [expression];
* - strip non ejs html and `<%` and `%>`
* - keep lines for counting
*
* options are supplied here - TODO use .ejslintrc
*
* @param {function} globs - for ejs files
* @param {function} callback - gulp callback
*/
function ejslint(globs, callback) {
  getFilenames(globs)
  .then((filenames) => { // jscs:ignore jsDoc
    return Promise.all(
      filenames.map(getFileContent)
    );
  })
  .then((files) => { // jscs:ignore jsDoc
    return Promise.all(
      files.map(replaceOutputTags)
    );
  })
  .then((files) => { // jscs:ignore jsDoc
    return Promise.all(
      files.map(replaceEjsTags)
    );
  })
  .then((files) => { // jscs:ignore jsDoc
    return Promise.all(
      files.map(fileJsHint)
    );
  })
  .then((files) => { // jscs:ignore jsDoc
    return Promise.all(
      files.map(report)
    );
  })
  .then(() => { // jscs:ignore jsDoc
    callback();
  })
  ;
}

// some Promises for ejslint

/**
 * get list of files for glob pattern
 *
 * @private
 * @param {function} globs - patterns for paths
 */
const getFilenames = (globs) => {
  return new Promise((resolve, reject) => { // jscs:ignore jsDoc
    globs.forEach((path) => { // jscs:ignore jsDoc
      glob(path, (error, filenames) => { // jscs:ignore jsDoc
        if (error) {
          reject(error);
        } else {
          resolve(filenames);
        }
      });
    });
  });
};

/**
 * Get the file content
 *
 * @private
 * @param {function} filename - to open
 */
const getFileContent = (filename) => {
  return new Promise((resolve, reject) => { // jscs:ignore jsDoc
    fs.readFile(filename, (error, data) => { // jscs:ignore jsDoc
      if (error) {
        reject(error);
      } else {
        resolve({ filename: filename, content: data.toString() });
      }
    });
  });
};

/**
 * Replace expression output tags
 *
 * @private
 * @param {function} file - file object with contents
 */
const replaceOutputTags = (file) => {
  return new Promise((resolve) => { // jscs:ignore jsDoc
    file.noOutput = '<% var output, output_raw; %>' + file.content
      .replace(/<%= *(.+?) *%>/g, '<% output = $1; %>')
      .replace(/<%- *(.+?) *%>/g, '<% output_raw = $1; %>')
      .replace(/<% *include +(.+?) *%>/g, '<% include = \'$1\'; %>');
    resolve(file);
  });
};

/**
 * Replace html outside of ejs tags with returns
 *
 * @private
 * @param {function} file - file object with contents
 */
const replaceEjsTags = (file) => {
  return new Promise((resolve) => { // jscs:ignore jsDoc
    let parts = file.noOutput.split(/<%/);
    let output = [];
    parts.forEach((part) => { // jscs:ignore jsDoc
      let snips = part.split(/%>/);
      output.push(snips[0]);
      output.push(snips.join('%>').replace(/[^\n]/g, ''));
    });
    file.jsCode = output.join('');
    resolve(file);
  });
};

/**
 * jshint the remaining content
 *
 * @private
 * @param {function} file - file object with contents
 */
const fileJsHint = (file) => {
  return new Promise((resolve) => { // jscs:ignore jsDoc
    jshint(file.jsCode, { asi: true }, { });
    if (jshint.errors) {
      file.errors = jshint.errors;
    }
    file.jshint = jshint.data();
    resolve(file);
  });
};

/**
 * report errors
 *
 * @private
 * @param {function} file - file object with contents
 */
const report = (file) => {
  return new Promise((resolve) => { // jscs:ignore jsDoc
    if (file.jshint.errors) {
      console.log('ERRORS in ' + file.filename);
      file.jshint.errors.forEach((error) => { // jscs:ignore jsDoc
        console.log('ERROR: ' + error.line + '/' + error.character + ' ' + error.reason);
      });
    }
    resolve(file);
  });
};

module.exports = {
  ejslint: ejslint
};
