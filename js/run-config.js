/**
 * start the test on the server
 */
'use strict';

/* jshint esversion: 5, varstmt: false, browser: true */
/* exported runAll, run, clear */

/**
 * run all configurations
 */
function runAll() {
  var app = document.getElementById('app');
  app.className = 'running runall app';
  var response = document.getElementById('response');
  response.innerHTML = '';
  var verbose = document.params.verbose.checked ? '/verbose' : '';
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open('GET', '/run/all' + verbose, true);
  xmlhttp.responseType = 'text';
  xmlhttp.onload = function () { // jscs:ignore jsDoc
    document.location.reload();
  };
  xmlhttp.send();
}

/**
 * run a configuration
 *
 * @param {String} config - config name
 */
function run(config) {
  var main = document.getElementById('app');
  main.className = 'running app';
  var response = document.getElementById('response');
  response.innerHTML = '';
  var verbose = document.params.verbose.checked ? '/verbose' : '';
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open('GET', '/run/' + config + verbose, true);
  xmlhttp.responseType = 'text';
  xmlhttp.onload = function () { // jscs:ignore jsDoc
    document.location.reload();
  };
  xmlhttp.onreadystatechange = function () { // jscs:ignore jsDoc
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      //response.innerHTML = xmlhttp.responseText;
      if (xmlhttp.responseText.indexOf('starting') != 0) {
        main.className = 'app';
      }
    }
  };
  xmlhttp.send();
}

/**
 * clear results directory
 *
 * @param {String} config - config name
 */
function clear(config) {
  var main = document.getElementById('app');
  main.className = 'clear app';
  var response = document.getElementById('response');
  response.innerHTML = '';
  var verbose = document.params.verbose.checked ? '/verbose' : '';
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open('GET', '/clear/' + config + verbose, true);
  xmlhttp.responseType = 'text';
  xmlhttp.onreadystatechange = function () { // jscs:ignore jsDoc
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      response.innerHTML = xmlhttp.responseText;
      main.className = 'app';
    }
  };
  xmlhttp.send();
}
