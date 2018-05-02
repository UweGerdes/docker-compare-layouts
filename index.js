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

const del = require('del'),
  exec = require('child_process').exec,
  fs = require('fs'),
  makeDir = require('make-dir'),
  path = require('path'),
  styleTree = require('./bin/style-tree.js');

/**
 * get config name from args and get the config file
 *
 * @param {String} arg - single argument string - find not -someting but .js or .json
 */
const configFile = process.argv.slice(2).filter(arg => arg.match(/^[^-].+\.js(on)?$/)),
  config = require('./config/' + configFile[0]),
  resultsDir = './results',
  destDir = path.join(resultsDir, config.destDir),
  verbose = process.argv.indexOf('-v') > -1;

/**
 * load page
 *
 * @param {String} pageKey - configuration page key
 */
function loadPage(pageKey) {
  const page = config.pages[pageKey];
  if (page.cache && chkCacheFile(path.join(destDir, pageKey,
        Object.keys(config.viewports)[0], 'page.png'))) {
    console.log('cached page  ' + pageKey + ': ' + page.url);
    return new Promise((resolve) => { // jscs:ignore jsDoc
      resolve({ 'pageKey': pageKey, 'status': 'cached' });
    });
  }
  del(path.join(destDir, pageKey));
  return new Promise((resolve, reject) => { // jscs:ignore jsDoc
    let args = [
      './bin/load-page-styles.js',
      '--configFile=config/"' + configFile + '"',
      '--pageKey="' + pageKey + '"'];
    let cmd = 'casperjs';
    if (page.engine) {
      args.unshift('--engine="' + page.engine + '"');
      if (page.engine == 'slimerjs') {
        if (process.platform == 'linux') {
          // cmd = 'xvfb-run -a -e /dev/stdout casperjs';
          cmd = 'xvfb-run -a casperjs';
        }
      }
    }
    console.log('loading page ' + pageKey + ': ' + page.url);
    const loader = exec(cmd + ' ' + args.join(' '),
      (error, stdout, stderr) => { // jscs:ignore jsDoc
        if (verbose || stdout.indexOf('element not found') > -1) {
          console.log(pageKey + ': ' + stdout.trim() +
              (stderr ? '\n' + cmd + ' stderr: ' + stderr.trim() : ''));
        }
      }
    );
    loader.stderr.on('data', (stderr) => { // jscs:ignore jsDoc
      console.log(pageKey + ' stderr: ' + stderr.trim());
    });
    loader.on('error', (error) => { // jscs:ignore jsDoc
      console.log(pageKey + ' error: ' + error);
    });
    loader.on('close', (error) => { // jscs:ignore jsDoc
      console.log('loaded page ' + pageKey + ': ' + page.url);
      if (error > 0) {
        reject({ 'pageKey': pageKey, 'status': 'error', 'exitcode': error });
      } else {
        resolve({ 'pageKey': pageKey, 'status': 'loaded' });
      }
    });
  });
}

/**
 * compare data
 *
 * @param {Object} result - compare result
 */
function compareData(result) {
  return new Promise((resolve) => { // jscs:ignore jsDoc
    const compareKey = result.compareKey;
    const viewport = result.viewport;
    const compare = config.compares[compareKey];
    const page1 = config.pages[compare.page1];
    const page2 = config.pages[compare.page2];
    const selector1 = compare.selector1 ? compare.selector1 : page1.selector;
    const selector2 = compare.selector2 ? compare.selector2 : page2.selector;
    const baseFilename1 = path.join(destDir, compare.page1, viewport, safeFilename(selector1));
    const baseFilename2 = path.join(destDir, compare.page2, viewport, safeFilename(selector2));
    const basePath = path.join(destDir, safeFilename(compareKey), viewport);
    Object.assign(result, {
      name: compareKey,
      viewport: viewport,
      page1: page1,
      page2: page2,
      subdir1: compare.page1,
      subdir2: compare.page2,
      selector1: selector1,
      selector2: selector2,
      baseFilename1: baseFilename1,
      baseFilename2: baseFilename2,
      exists1: chkCacheFile(baseFilename1 + '.json'),
      exists2: chkCacheFile(baseFilename2 + '.json'),
      success: true,
      path: basePath,
      compareFilename: basePath + '_compare.png',
      compositeFilename: basePath + '_composite.png',
      jsonFilename: basePath + '.json',
      htmlFilename: basePath + '.html'
    });
    resolve(result);
  });
}

/**
 * compare images
 *
 * @param {Object} result - compare result
 */
function compareImages(result) {
  return new Promise((resolve) => { // jscs:ignore jsDoc
    exec('compare -metric AE "' + result.baseFilename1 + '.png" "' +
        result.baseFilename2 + '.png" ' + result.compareFilename,
      (error, stdout, stderr) => { // jscs:ignore jsDoc
        if (stderr.match(/^[0-9]+$/)) {
          result.compareImagesStderr = stderr;
          if (verbose) { console.log(result.compareFilename + ' saved'); }
          if (stderr != '0') {
            result.success = false;
          }
        } else {
          result.compareImagesStderr = stderr.replace(/[^ ]+ @.+/, '');
          result.compareFilename = '';
          result.success = false;
        }
        resolve(result);
      }
    );
  });
}

/**
 * composite images
 *
 * @param {Object} result - compare result
 */
function compositeImages(result) {
  return new Promise((resolve) => { // jscs:ignore jsDoc
    exec('composite -compose difference "' + result.baseFilename1 + '.png" "' +
        result.baseFilename2 + '.png" ' + result.compositeFilename,
      (error, stdout, stderr) => { // jscs:ignore jsDoc
        if (stderr.length === 0) {
          if (verbose) { console.log(result.compositeFilename + ' saved'); }
        } else {
          result.compositeImagesStderr = 'stderr: ' + stderr;
          result.compositeFilename = '';
          result.success = false;
        }
        resolve(result);
      }
    );
  });
}

/**
 * compare styles
 *
 * @param {Object} comp - compare result
 */
function compareStyleTree(comp) {
  const compare = config.compares[comp.compareKey];
  const page1 = config.pages[compare.page1];
  const selector1 = compare.selector1 ? compare.selector1 : page1.selector;
  const page2 = config.pages[compare.page2];
  const selector2 = compare.selector2 ? compare.selector2 : page2.selector;
  const styleTree1 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,
    compare.page1, comp.viewport, safeFilename(selector1) + '.json'))));
  const styleTree2 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,
    compare.page2, comp.viewport, safeFilename(selector2) + '.json'))));
  const compareResult = styleTree1.compareTo(styleTree2, compare.compare);
  const jsonFilename = path.join(destDir, safeFilename(comp.compareKey), comp.viewport + '.json');
  return new Promise((resolve, reject) => { // jscs:ignore jsDoc
    fs.writeFile(jsonFilename, JSON.stringify(compareResult, undefined, 4),
      (error) => { // jscs:ignore jsDoc
        if (error) {
          console.log(jsonFilename + ' error: ' + error);
          compare.error = error;
          reject(compare);
        }
        if (verbose) {
          console.log(jsonFilename + ' saved');
        }
        compare.jsonFilename = jsonFilename;
        resolve(compare);
      }
    );
  });
}

/**
 * save results
 *
 * @param {Object} results - compare results
 */
function saveResults(results) {
  let output = { };
  results.forEach((result) => { // jscs:ignore jsDoc
    output[result.compareKey + '_' + result.viewport] = result;
  });
  fs.writeFile(path.join(destDir, 'index.json'), JSON.stringify(output, null, 4),
    (error) => { // jscs:ignore jsDoc
      if (error) {
        console.log(path.join(destDir, 'index.json') + ' error: ' + error);
      } else {
        console.log('result in: ' + path.join(destDir, 'index.json'));
      }
    }
  );
}

let results = { };
let compares = [];

Object.keys(config.compares).forEach((compareKey) => { // jscs:ignore jsDoc
  Object.keys(config.viewports).forEach((viewport) => { // jscs:ignore jsDoc
    compares.push({ 'compareKey': compareKey, 'viewport': viewport });
  });
});

// jscs:disable jsDoc
makeDir(destDir)
.then((path) => {
  console.log('Results in:', path);
  return path;
})
.then(() => {
  const pageKeys = Object.keys(config.pages);
  return Promise.all(
    pageKeys.map(loadPage)
  );
})
.then((pages) => {
  results.pages = pages;
  return Promise.all(
    compares.map(compareData)
  );
})
.then(() => {
  return Promise.all(
    Object.keys(config.compares).map((compareKey) => {
      return del(path.join(destDir, safeFilename(compareKey)));
    })
  );
})
.then(() => {
  return Promise.all(
    Object.keys(config.compares).map((compareKey) => {
      return makeDir(path.join(destDir, safeFilename(compareKey)));
    })
  );
})
.then(() => {
  return Promise.all(
    compares.map(compareImages)
  );
})
.then((compares) => {
  results.compares = compares;
  return Promise.all(
    compares.map(compositeImages)
  );
})
.then((compares) => {
  results.compares = compares;
  return Promise.all(
    compares.map(compareStyleTree)
  );
})
.then(() => {
  saveResults(results.compares);
})
.catch((error) => {
  console.error('Failed!', error);
});
// jscs:enable jsDoc

/**
 * check if file is already cached
 *
 * @param {String} file - file name
 */
function chkCacheFile(file) {
  try {
    return fs.lstatSync(file).isFile();
  } catch (error) {
    //console.log('chkCacheFile ' + file + ' not found');
  }
  return false;
}

/**
 * get a safe filename (no os specific chars
 *
 * @param {String} name - file name
 */
function safeFilename(name) {
  return name.replace(/[ .?#/:\(\)<>|\\]/g, '_').trim();
}
