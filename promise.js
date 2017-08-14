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
    console.log('loading page ' + page.url + ' ' + pageKey);
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
        reject({'pageKey': pageKey, 'status': 'error', 'exitcode': code});
      } else {
        resolve({'pageKey': pageKey, 'status': 'loaded'});
      }
    });
  });
}

function compareImages(compareSet) {
  var compareKey = compareSet.compareKey;
  var viewport = compareSet.viewport;
  var compare = config.compares[compareKey];
  var page1 = config.pages[compare.page1];
  var page2 = config.pages[compare.page2];
  return new Promise(function(resolve, reject) {
    if (!fs.existsSync(path.join(destDir,  safeFilename(compareKey)))) {
      fs.mkdirSync(path.join(destDir,  safeFilename(compareKey)));
    }
    var result = {};
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
    result.htmlFilename1 = destDir + '/' +  compare.page1 + '/' +  viewport + '/' +  safeFilename(result.selector1);
    result.htmlFilename2 = destDir + '/' + compare.page2 + '/' +  viewport + '/' +  safeFilename(result.selector2);
    result.exists1 = chkCacheFile(result.baseFilename1 + '.json');
    result.exists2 = chkCacheFile(result.baseFilename2 + '.json');
    result.success = true;
    result.path = path.join(destDir,  safeFilename(compareKey),  viewport);
    result.compareFilename = result.path + '_compare.png';
    result.compositeFilename = result.path + '_composite.png';
    result.jsonFilename = result.path + '.json';
    result.htmlFilename = result.path + '.html';
    exec('compare -metric AE "' + result.baseFilename1 + '.png" "' + result.baseFilename2 + '.png" ' + result.compareFilename,
      function (error, stdout, stderr) {
        //if (verbose) { logExecResult('compare', null, stdout, stderr.replace(/ @.+/, '').replace(/^0$/, '')); }
        if (stderr == '0') {
          if (verbose) { console.log(result.compareFilename + ' saved'); }
        } else {
          result.success = false;
        }
        result.imageStderr = stderr;
        exec('composite -compose difference "' + result.baseFilename1 + '.png" "' + result.baseFilename2 + '.png" ' + result.compositeFilename,
          function (error, stdout, stderr) {
            //logExecResult('composite', null, stdout, stderr.replace(/ @.+/, ''));
            if (stderr.length === 0) {
              if (verbose) { console.log(result.compositeFilename + ' saved'); }
            } else {
              result.compositeFilename = '';
              result.success = false;
            }
            resolve({ 'compareKey': compareKey, 'viewport': viewport, 'result': result});
          }
        );
      }
    );
  });
}

function compareStyleTree(compare) {
  var compareKey = compare.compareKey;
  var viewport = compare.viewport;
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
      resolve({'compareKey': compareKey, 'viewport': viewport, 'resultFilename': jsonFilename});
    });
  });
}

var results = {};
var compares = [];
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
    compares.map(compareImages)
  );
}).then(function(data) {
  results.data = data;
  return Promise.all(
    compares.map(compareStyleTree)
  );
});
promise.then(function(compared) {
//  results.compared = compared;
  console.log("results:", JSON.stringify(results, undefined, 4));
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
