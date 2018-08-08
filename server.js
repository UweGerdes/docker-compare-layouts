/*
 * HTTP-Server for compare-layouts
 *
 * (c) Uwe Gerdes, entwicklung@uwegerdes.de
 */
'use strict';

const bodyParser = require('body-parser'),
  chalk = require('chalk'),
  exec = require('child_process').exec,
  dateFormat = require('dateformat'),
  _eval = require('eval'),
  express = require('express'),
  fs = require('fs'),
  fsTools = require('fs-tools'),
  glob = require('glob'),
  makeDir = require('make-dir'),
  morgan = require('morgan'),
  path = require('path'),
  ipv4addresses = require('./bin/ipv4addresses.js'),
  obj2html = require('./bin/obj2html.js'),
  logConsole = require('./bin/log.js'),
  app = express();

const livereloadPort = process.env.GULP_LIVERELOAD_PORT || 8081,
  httpPort = process.env.COMPARE_LAYOUTS_HTTP || 8080;

const configDir = path.join(__dirname, 'config'),
  resultsDir = path.join(__dirname, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

let running = [];

/**
 * Weberver logging
 *
 * using log format starting with [time]
 */
if (process.env.VERBOSE !== 'false') {
  morgan.token('time', () => { // jscs:ignore jsDoc
    return dateFormat(new Date(), 'HH:MM:ss');
  });
  app.use(morgan('[' + chalk.gray(':time') + '] ' +
    ':method :status :url :res[content-length] - :response-time ms'));
}

// work on post requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(__dirname));

/**
 * Handle requests for app view
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get(/^\/app\/(.+)?$/, (req, res) => {
  const configs = getConfigs();
  let data = { };
  const action = req.query.action || 'show';
  if (req.params[0]) {
    if (fs.existsSync(path.join(configDir, req.params[0] + '.js'))) {
      data = getConfig(req.params[0]);
    } else {
      data.error = 'config file not found: ./config/' + req.params[0] + '.js';
      logConsole.info('config file not found: ./config/' + req.params[0] + '.js');
    }
  }
  res.render('appView.ejs', {
    action: action,
    config: data.config,
    configs: configs,
    error: data.error,
    file: data.file,
    lastRun: data.lastRun,
    logfile: data.logfile,
    name: data.name,
    results: data.result,
    running: running,
    livereloadPort: livereloadPort,
    httpPort: httpPort
  });
});

/**
 * Handle requests for app view
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get(/^\/show\/(.+?)\/([^/]+)\/([^/]+)$/, (req, res) => {
  const data = getConfig(req.params[0]);
  const compare = getCompare(data.config.destDir, req.params[1], req.params[2]);
  const result = getResult(data.config.destDir)[req.params[1] + '_' + req.params[2]];
  let page1,
    page2;
  if (result !== null && result !== undefined) {
    page1 = data.config.pages[result.page1];
    page2 = data.config.pages[result.page2];
  }

  res.render('resultView.ejs', {
    config: data.config,
    compare: obj2html.toHtml(compare),
    page1: page1,
    page2: page2,
    result: result,
    viewport: req.params[2],
    livereloadPort: livereloadPort,
    httpPort: httpPort,
    running: running
  });
});

/**
 * Handle AJAX requests for run configs
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get(/^\/run\/(.+?)(\/verbose)?$/, (req, res) => {
  if (req.params[0] == 'all') {
    const configs = getConfigs();
    configs.forEach((data) => { // jscs:ignore jsDoc
      console.log('starting ' + data);
      runConfigAsync(data, req.params[1], res);
    });
  } else {
    runConfigAsync(getConfig(req.params[0]), req.params[1], res);
  }
});

/**
 * Handle AJAX requests for run configs
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get(/^\/clear\/(.+)$/, (req, res) => {
  if (req.params[0] == 'all') {
    const configs = getConfigs();
    configs.forEach((data) => { // jscs:ignore jsDoc
      clearResult(data, res);
    });
  } else {
    clearResult(getConfig(req.params[0]), res);
  }
});

/**
 * Route for root dir
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Route for everything else.
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get('*', (req, res) => {
  res.status(404).send('Sorry cant find that: ' + req.url);
});

/**
 * Handle form POST requests for app view
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.post('/app/:config?/:action?', (req, res) => {
  const configs = getConfigs();
  let data = { };
  let action = 'show';
  logConsole.info('post: ' + req.params.config + ' ' + req.params.action);
  if (req.params.config) {
    if (fs.existsSync(path.join(configDir, req.params.config + '.js'))) {
      data = getConfig(req.params.config);
    } else {
      data.error = 'config file not found ./config/' + req.params.config + '.js';
      logConsole.info('config file not found: ./config/' + req.params.config + '.js');
    }
    if (req.params.action) {
      action = req.params.action;
      if (action == 'edit' && req.body.configfile) {
        storeConfig(data, req.body.configfile);
        action = 'check';
      } else {
        logConsole.info('not written: ' + configDir + '/' + data.name + '.js\n' +
            JSON.stringify(req.body, null, 4));
        action = '';
      }
    }
  }
  res.render('appView.ejs', {
    configs: configs,
    config: data,
    action: action,
    livereloadPort: livereloadPort,
    httpPort: httpPort,
    running: running
  });
});

// Fire it up!
app.listen(httpPort);
logConsole.info('compare-layouts server listening on ' +
  chalk.greenBright('http://' + ipv4addresses.get()[0] + ':' + httpPort));

// Model //
/**
 * get list of configurations and result status
 */
function getConfigs() {
  let configs = [];
  const filenames = glob.sync(
    '{' + path.join('config', '*.js') +
    ',' + path.join('config', '**', 'tests', 'compare-layouts', '*.js') +
    '}'
  );
  filenames.forEach((fileName) => { // jscs:ignore jsDoc
    const configName = fileName.replace(/(\.\/)?(config\/)?(.+)\.js/, '$3');
    configs.push(getItem(configName));
  });
  configs.forEach((data) => { // jscs:ignore jsDoc
    data.result = getResult(data.config.destDir);
    getSummary(data);
  });
  return configs;
}

/**
 * get full config info
 *
 * @param {String} configName - base name of configuration file
 */
function getItem(configName) {
  let data = { name: configName };
  data.config = getConfigData(configName);
  data.lastRun = 'Keine Daten';
  try {
    const fileStat = fs.statSync(path.join(resultsDir, data.config.destDir, 'index.json'));
    data.lastRun = dateFormat(fileStat.mtime, 'dd.mm.yyyy, HH:MM:ss');
  } catch (err) {
    if (err.length > 0 && err.code != 'ENOENT') {
      logConsole.info(configName + ' error: ' + JSON.stringify(err, null, 4));
    }
  }
  return data;
}

/**
 * get data for config
 *
 * @param {String} configName - base name of configuration file
 */
function getConfig(configName) {
  let data = { name: configName };
  data.file = getConfigFile(configName);
  data.config = getConfigData(configName);
  try {
    const fileStat = fs.statSync(path.join(resultsDir, data.config.destDir, 'index.json'));
    data.lastRun = dateFormat(fileStat.mtime, 'dd.mm.yyyy, HH:MM:ss');
  } catch (err) {
    data.lastRun = 'Keine Daten im Verzeichnis ./results';
    if (err.length > 0 && err.code != 'ENOENT') {
      logConsole.info(configName + ' error: ' + JSON.stringify(err, null, 4));
    }
  }
  if (data.config.destDir) {
    data.logfile = getLogfile(data.config.destDir);
    data.result = getResult(data.config.destDir);
  }
  return data;
}

/**
 * get content of config file
 *
 * @param {String} configName - base name of configuration file
 */
function getConfigFile(configName) {
  let content = 'not found';
  const configPath = path.join(configDir, configName + '.js');
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath).toString();
  }
  return content;
}

/**
 * get data from config file
 *
 * @param {String} configName - base name of configuration file
 */
function getConfigData(configName) {
  let configData = '';
  try {
    const configFileContent = getConfigFile(configName);
    configData = _eval(configFileContent);
  } catch (err) {
    //configData.error = err;
  }
  return configData;
}

/**
 * get log file content
 *
 * @param {String} destDir - destination directory for results
 */
function getLogfile(destDir) {
  const logfilePath = path.join(__dirname, 'results', destDir, 'console.log');
  let logfileContent = '';
  try {
    logfileContent = replaceAnsiColors(fs.readFileSync(logfilePath).toString()
        .replace(/\n\n/g, '\n'));
  } catch (err) {
    // no log file
  }
  return logfileContent;
}

/**
 * get result data
 *
 * @param {String} destDir - destination directory for results
 */
function getResult(destDir) {
  let result = { };
  try {
    result = JSON.parse(fs.readFileSync(path.join(resultsDir, destDir, 'index.json')));
  } catch (err) {
    // probably file not found
  }
  return result;
}

/**
 * get compare data
 *
 * @param {String} destDir - destination directory for results
 * @param {Object} compare - data
 * @param {String} viewport - viewport name
 */
function getCompare(destDir, compare, viewport) {
  const filename = path.join(resultsDir, destDir, compare, viewport + '.json');
  let result = { };
  try {
    result = JSON.parse(fs.readFileSync(filename));
  } catch (err) {
    logConsole.info('compare file not found: ' + filename);
    // probably file not found
  }
  return result;
}

/**
 * calculate result summary
 *
 * @param {Object} data - configuration
 */
function getSummary(data) {
  data.success = true;
  data.totalTests = 0;
  data.failedTests = 0;
  Object.keys(data.result).forEach((key) => { // jscs:ignore jsDoc
    if (!data.result[key].success) {
      data.success = false;
      data.failedTests++;
    }
    data.totalTests++;
  });
}

/**
 * start compare-layouts with config file
 *
 * @param {Object} data - configuration
 * @param {Boolean} verbose - make more output
 * @param {Object} res - result
 */
function runConfigAsync(data, verbose, res) {
  const destDir = path.join(__dirname, 'results', data.config.destDir);
  const log = (msg) => { // jscs:ignore jsDoc
    logConsole.info(msg);
    res.write(replaceAnsiColors(msg) + '\n');
  };
  if (!fs.existsSync(destDir)) {
    makeDir.sync(destDir);
  }
  log('server started ' + data.name);
  running.push(data.name);
  const configFilename = './config/' + data.name + '.js';
  const loader = exec('node index.js ' + configFilename + (verbose ? ' -v' : ''));
  loader.stdout.on('data', (data) => { log(data.toString().trim()); }); // jscs:ignore jsDoc
  loader.stderr.on('data', (data) => { log(data.toString().trim()); }); // jscs:ignore jsDoc
  loader.on('error', (err) => { log(' error: ' + err.toString().trim()); }); // jscs:ignore jsDoc
  loader.on('close', (code) => { // jscs:ignore jsDoc
    if (code > 0) {
      log('load ' + data.name + ' error, exit-code: ' + code);
    }
    log('server finished ' + data.name);
    running.splice(running.indexOf(data.name), 1);
    if (running.length === 0) {
      res.end();
    }
  });
}

/**
 * delete results directory
 *
 * @param {Object} data - configuration
 * @param {Object} res - result
 */
function clearResult(data, res) {
  const destDir = path.join(__dirname, 'results', data.config.destDir);
  const log = (msg) => { // jscs:ignore jsDoc
    logConsole.info(msg);
    res.write(replaceAnsiColors(msg) + '\n');
  };
  if (fs.existsSync(destDir)) {
    fsTools.removeSync(destDir);
  }
  log('Ergebnisse gelöscht für ' + data.name);
  res.end();
}

/**
 * save configuration
 *
 * @param {Object} data - configuration
 * @param {Object} configData - data
 */
function storeConfig(data, configData) {
  fs.writeFileSync(configDir + '/' + data.name + '.js', configData, 0);
  logConsole.info('written: ' + configDir + '/' + data.name + '.js');
  data.file = getConfigFile(data.name);
  data.config = getConfigData(data.name);
  if (data.config.length === 0) {
    data.error = 'Syntax error in config file.';
  }
}

// TODO make module
/**
 * replace ANSI colors with style
 *
 * @param {String} string - to convert
 */
function replaceAnsiColors(string) {
  let result = '';
  const replaceTable = {
    '0': 'none',
    '1': 'font-weight: bold',
    '4': 'text-decoration: underscore',
    '5': 'text-decoration: blink',
    '7': 'text-decoration: reverse',
    '8': 'text-decoration: concealed',
    '30': 'color: black',
    '31': 'color: red',
    '32': 'color: green',
    '33': 'color: yellow',
    '34': 'color: blue',
    '35': 'color: magenta',
    '36': 'color: cyan',
    '37': 'color: white',
    '40': 'background-color: black',
    '41': 'background-color: red',
    '42': 'background-color: green',
    '43': 'background-color: yellow',
    '44': 'background-color: blue',
    '45': 'background-color: magenta',
    '46': 'background-color: cyan',
    '47': 'background-color: white'
  };
  string.toString().split(/(\x1B\[[0-9;]+m)/).forEach((part) => { // jscs:ignore jsDoc
    if (part.match(/(\x1B\[[0-9;]+m)/)) {
      part = part.replace(/\x1B\[([0-9;]+)m/, '$1');
      if (part == '0') {
        result += '</span>';
      } else {
        result += '<span style="';
        part.split(/(;)/).forEach((x) => { // jscs:ignore jsDoc
          if (replaceTable[x]) {
            result += replaceTable[x];
          } else {
            result += x;
          }
        });
        result += '">';
      }
    } else {
      result += part;
    }
  });
  return result;
}
