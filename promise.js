/**
 * load pages in phantomjs or slimerjs, grab elements, use viewports, prepare results for server
 */

'use strict';

var exec = require('child_process').exec,
  fs = require('fs'),
  path = require('path'),
  styleTree = require('./bin/style-tree.js');

var configFile = 'config/default.js',
  config = null;

config = require('./' + configFile);
var resultsDir = './results';
var destDir = path.join(resultsDir, config.destDir);

var verbose = process.argv.indexOf('-v') > -1;

function getFile(filename) {
  console.log('reading: ' + filename);
  return new Promise(
    function(resolve, reject) {
      fs.readFile(filename, function(err, data) {
        if (err) {
          reject(Error(err.code));
        }
        resolve(data.toString());
      });
    }
  );
}

function getJSON(filename) {
  return getFile(filename).then(JSON.parse);
}

function loadPage(pageKey) {
  var page = config.pages[pageKey];
  if (page.cache && chkCacheFile(pageKey)) {
    return new Promise(function(resolve, reject) {
      resolve(pageKey);
    });
  }
  return new Promise(function(resolve, reject) {
    var args = [
      './bin/load-page-styles.js',
      '--configFile="' + configFile + '"',
      '--pageKey="' + pageKey + '"'];
    var cmd = 'casperjs';
    if (page.engine) {
      args.unshift('--engine="' + page.engine + '"');
      if (page.engine == 'slimerjs') {
        if (process.platform == "linux") {
//        cmd = 'xvfb-run -a -e /dev/stdout casperjs';
          cmd = 'xvfb-run -a casperjs';
        }
      }
    }
    var loader = exec(cmd + ' ' + args.join(' '));
    loader.stdout.on('data', function(data) {
      if (verbose || data.indexOf('element not found') > -1) {
        console.log(pageKey + ': ' + data.trim());
      }
    });
    loader.stderr.on('data', function(data) {
      console.log(pageKey + ' stderr: ' + data);
    });
    loader.on('error', function(err) {
      console.log(pageKey + ' error: ' + err);
    });
    loader.on('close', function(code) {
        console.log('loaded page ' + page.url + ' ' + pageKey);
      if (code > 0) {
        reject('load ' + pageKey + ' exit: ' + code);
      } else {
        resolve(pageKey);
      }
    });
  });
}

function compareStyleTree(compareKey) {
  var viewport = 'Desktop';
  return new Promise(function(resolve, reject) {
    if (!fs.existsSync(path.join(destDir,  safeFilename(compareKey)))) {
      fs.mkdirSync(path.join(destDir,  safeFilename(compareKey)));
    }
    var compare = config.compares[compareKey];
    var page1 = config.pages[compare.page1];
    var selector1 = compare.selector1 ? compare.selector1 : page1.selector;
    var page2 = config.pages[compare.page2];
    var selector2 = compare.selector2 ? compare.selector2 : page2.selector;
    var styleTree1 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,  compare.page1,  viewport,  safeFilename(selector1) + '.json'))));
    var styleTree2 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,  compare.page2,  viewport,  safeFilename(selector2) + '.json'))));
    var compareResult = styleTree1.compareTo(styleTree2, compare.compare);
    var jsonFilename = path.join(destDir,  safeFilename(compareKey),  viewport + '.json');
    fs.writeFile(jsonFilename, JSON.stringify(compareResult, undefined, 4), function(err) {
      if(err) {
        console.log(jsonFilename + ' error: ' + err);
        reject({'compareKey': compareKey, 'error': err});
      }
      console.log(jsonFilename + ' saved');
    });
    resolve({ 'compareKey': compareKey, 'resultFilename': jsonFilename});
  });
}


var promise = new Promise((resolve, reject) => { resolve(path.basename(__filename)); });
promise.then(function(response) {
  console.log("Starting:", response);
  return response;
}).then(function(list) {
  var paths = list.storyFiles.map(function (name) {return path.join('tests', name);});
  console.log('paths:', JSON.stringify(paths, undefined, 4));
  return Promise.all(
    paths.map(getJSON)
  );
}).then(function(response) {
  console.log("Success2:", JSON.stringify(response, undefined, 4));
}).catch(function(error) {
  console.error("Failed!", error);
}).then(function(response) {
  var pageKeys = Object.keys(config.pages);
  return Promise.all(
    pageKeys.map(loadPage)
  );
}).then(function(response) {
  console.log("Success3:", JSON.stringify(response, undefined, 4));
}).then(function(response) {
  var compares = Object.keys(config.compares);
  return Promise.all(
    compares.map(compareStyleTree)
  );
}).then(function(response) {
  console.log("Success4:", JSON.stringify(response, undefined, 4));
}).catch(function(error) {
  console.error("Failed!", error);
});


function chkCacheFile(pageKey) {
  try {
    return fs.lstatSync(path.join(destDir, pageKey)).isDirectory();
  } catch(err) {
    //console.log('chk ' + filename + ' not found');
  }
  return false;
}

function safeFilename(name) {
  return name.replace(/[ .?#/:\(\)<>|\\]/g, "_").trim();
}
