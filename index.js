/**
 * load pages in phantomjs or slimerjs, grab elements, use viewports, prepare results for server
 *
 * node index.js [configfile] [-v] [-r]
 *
 * configfile: config/[name].js
 * -v: verbose
 * -r: force reload / ignore cache
 *
 * (c) Uwe Gerdes, entwicklung@uwegerdes.de
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
      fs.readFile(filename, function(error, data) {
        if (error) {
          reject(Error(error.code));
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
  if (page.cache && chkCacheFile(path.join(destDir, pageKey, Object.keys(config.viewports)[0], 'page.png'))) {
    console.log('cached page  ' + pageKey + ': ' + page.url);
    return new Promise(function(resolve, reject) {
      resolve({'pageKey': pageKey, 'status': 'cached'});
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
    console.log('loading page ' + pageKey + ': ' + page.url);
    var loader = exec(cmd + ' ' + args.join(' '), function(error, stdout, stderr) {
      if (verbose || stdout.indexOf('element not found') > -1) {
        console.log(pageKey + ': ' + stdout.trim());
      }
    });
    loader.stderr.on('data', function(stderr) {
      console.log(pageKey + ' stderr: ' + stderr.trim());
    });
    loader.on('error', function(error) {
      console.log(pageKey + ' error: ' + error);
    });
    loader.on('close', function(error) {
      console.log('loaded page ' + pageKey + ': ' + page.url);
      if (error > 0) {
        reject({'pageKey': pageKey, 'status': 'error', 'exitcode': error});
      } else {
        resolve({'pageKey': pageKey, 'status': 'loaded'});
      }
    });
  });
}

function makeCompareDir(compareKey) {
  if (!fs.existsSync(path.join(destDir,  safeFilename(compareKey)))) {
    fs.mkdir(path.join(destDir,  safeFilename(compareKey)),function(error) {
      if (error) {
        console.log('makeCompareDir ' + compareKey + ' error: ' + error);
      }
      return new Promise(function(resolve, reject) {
        resolve(compareKey);
      });
    });
  } else {
    return new Promise(function(resolve, reject) {
      resolve(compareKey);
    });
  }
}

function compareData(result) {
  return new Promise(function(resolve, reject) {
    var compareKey = result.compareKey;
    var viewport = result.viewport;
    var compare = config.compares[compareKey];
    var page1 = config.pages[compare.page1];
    var page2 = config.pages[compare.page2];
    result.name = compareKey;
    result.viewport = viewport;
    result.page1 = page1;
    result.page2 = page2;
    result.subdir1 = compare.page1;
    result.subdir2 = compare.page2;
    result.selector1 = compare.selector1 ? compare.selector1 : page1.selector;
    result.selector2 = compare.selector2 ? compare.selector2 : page2.selector;
    result.baseFilename1 = path.join(destDir,  compare.page1,  viewport,  safeFilename(result.selector1));
    result.baseFilename2 = path.join(destDir,  compare.page2,  viewport,  safeFilename(result.selector2));
    result.htmlFilename1 = [destDir, compare.page1, viewport, safeFilename(result.selector1)].join('/');
    result.htmlFilename2 = [destDir, compare.page2, viewport, safeFilename(result.selector2)].join('/');
    result.exists1 = chkCacheFile(result.baseFilename1 + '.json');
    result.exists2 = chkCacheFile(result.baseFilename2 + '.json');
    result.success = true;
    result.path = path.join(destDir,  safeFilename(compareKey),  viewport);
    result.compareFilename = result.path + '_compare.png';
    result.compositeFilename = result.path + '_composite.png';
    result.jsonFilename = result.path + '.json';
    result.htmlFilename = result.path + '.html';
    resolve(result);
  });
}

function compareImages(result) {
  return new Promise(function(resolve, reject) {
    exec('compare -metric AE "' + result.baseFilename1 + '.png" "' + result.baseFilename2 + '.png" ' + result.compareFilename,
      function (error, stdout, stderr) {
        //if (verbose) { logExecResult('compare', null, stdout, stderr.replace(/ @.+/, '').replace(/^0$/, '')); }
        if (stderr == '0') {
          if (verbose) { console.log(result.compareFilename + ' saved'); }
        } else {
          result.compareFilename = '';
          result.success = false;
        }
        result.compareImagesStderr = stderr;
        resolve(result);
      }
    );
  });
}

function compositeImages(result) {
  return new Promise(function(resolve, reject) {
    exec('composite -compose difference "' + result.baseFilename1 + '.png" "' + result.baseFilename2 + '.png" ' + result.compositeFilename,
      function (error, stdout, stderr) {
        //logExecResult('composite', null, stdout, stderr.replace(/ @.+/, ''));
        if (stderr.length === 0) {
          if (verbose) { console.log(result.compositeFilename + ' saved'); }
        } else {
          result.compositeFilename = '';
          result.success = false;
        }
        result.compositeImagesStderr = stderr;
        resolve(result);
      }
    );
  });
}

function compareStyleTree(comp) {
  var compareKey = comp.compareKey;
  var viewport = comp.viewport;
  var compare = config.compares[compareKey];
  var page1 = config.pages[compare.page1];
  var selector1 = compare.selector1 ? compare.selector1 : page1.selector;
  var page2 = config.pages[compare.page2];
  var selector2 = compare.selector2 ? compare.selector2 : page2.selector;
  var styleTree1 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,  compare.page1,  viewport,  safeFilename(selector1) + '.json'))));
  var styleTree2 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,  compare.page2,  viewport,  safeFilename(selector2) + '.json'))));
  var compareResult = styleTree1.compareTo(styleTree2, compare.compare);
  var jsonFilename = path.join(destDir,  safeFilename(compareKey),  viewport + '.json');
  return new Promise(function(resolve, reject) {
    fs.writeFile(jsonFilename, JSON.stringify(compareResult, undefined, 4), function(error) {
      if(error) {
        console.log(jsonFilename + ' error: ' + error);
        compare.error = error;
        reject(compare);
      }
      console.log(jsonFilename + ' saved');
      compare.jsonFilename = jsonFilename;
      resolve(compare);
    });
  });
}

function saveResults(results) {
  let output = {};
  results.forEach(function (result) {
    output[result.compareKey + '_' + result.viewport] = result;
  });
  fs.writeFile(path.join(destDir,  'index.json'), JSON.stringify(output, null, 4), function(error) {
    if(error) {
      return console.log(path.join(destDir,  'index.json') + ' error: ' + error);
    }
    console.log('result in: ' + path.join(destDir,  'index.json'));
  });
}

var results = {};
var compares = [];

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
}

Object.keys(config.compares).forEach(function(compareKey) {
  Object.keys(config.viewports).forEach(function(viewport) {
    compares.push({'compareKey': compareKey, 'viewport': viewport});
  });
});
var promise = new Promise((resolve, reject) => { resolve(path.basename(__filename)); });
promise = promise.then(function(response) {
  console.log("Starting:", response);
  return response;
}).then(function(response) {
  var pageKeys = Object.keys(config.pages);
  return Promise.all(
    pageKeys.map(loadPage)
  );
}).then(function(pages) {
  results.pages = pages;
  return Promise.all(
    compares.map(compareData)
  );
}).then(function(data) {
  return Promise.all(
    Object.keys(config.compares).map(makeCompareDir)
  );
}).then(function() {
  return Promise.all(
    compares.map(compareImages)
  );
}).then(function(compares) {
  results.compares = compares;
  return Promise.all(
    compares.map(compositeImages)
  );
}).then(function(compares) {
  results.compares = compares;
  return Promise.all(
    compares.map(compareStyleTree)
  );
});
promise.then(function(compared) {
  saveResults(results.compares);
}).catch(function(error) {
  console.error("Failed!", error);
});

function makePath(directoryPath) {
  const directory = path.normalize(directoryPath);
  return new Promise((resolve, reject) => {
    fs.stat(directory, (error) => {
      if (error) {
        if (error.code === 'ENOENT') {
          fs.mkdir(directory, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(directory);
            }
          });
        } else {
          reject(error);
        }
      } else {
        resolve(directory);
      }
    });
  });
}

function chkCacheFile(file) {
  try {
    return fs.lstatSync(file).isFile();
  } catch(error) {
    //console.log('chkCacheFile ' + file + ' not found');
  }
  return false;
}

function safeFilename(name) {
  return name.replace(/[ .?#/:\(\)<>|\\]/g, "_").trim();
}
