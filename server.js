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
app.get('/app/:config?/:action?/:param?', (req, res) => {
  const configs = getConfigs();
  let config = { };
  let action = 'show';
  if (req.params.config) {
    if (fs.existsSync(path.join(configDir, req.params.config + '.js'))) {
      config = getConfig(req.params.config);
    } else {
      config.error = 'config file not found: ./config/' + req.params.config + '.js';
      logConsole.info('config file not found: ./config/' + req.params.config + '.js');
    }
    if (req.params.action) {
      action = req.params.action;
    }
  }
  res.render('appView.ejs', {
    configs: configs,
    config: config,
    action: action,
    livereloadPort: livereloadPort,
    httpPort: httpPort,
    running: running
  });
});

/**
 * Handle requests for app view
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get('/show/:config/:compare/:viewport', (req, res) => {
  const config = getConfig(req.params.config);
  const compare = getCompare(config.data.destDir, req.params.compare, req.params.viewport);
  const result = getResult(config.data.destDir)[req.params.compare + '_' + req.params.viewport];
  let page1,
    page2;
  if (result !== null && result !== undefined) {
    page1 = config.data.pages[result.page1];
    page2 = config.data.pages[result.page2];
  }

  res.render('resultView.ejs', {
    config: config,
    compare: obj2html.toHtml(compare),
    page1: page1,
    page2: page2,
    result: result,
    viewport: req.params.viewport,
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
app.get('/run/:config/:verbose?', (req, res) => {
  console.log('starting ' + req.params.config);
  if (req.params.config == 'all') {
    const configs = getConfigs();
    configs.forEach((config) => { // jscs:ignore jsDoc
      console.log('starting ' + config);
      runConfigAsync(config, req.params.verbose, res);
    });
  } else {
    runConfigAsync(getConfig(req.params.config), req.params.verbose, res);
  }
});

/**
 * Handle AJAX requests for run configs
 *
 * @param {Object} req - request
 * @param {Object} res - result
 */
app.get('/clear/:config', (req, res) => {
  if (req.params.config == 'all') {
    const configs = getConfigs();
    configs.forEach((config) => { // jscs:ignore jsDoc
      clearResult(config, res);
    });
  } else {
    clearResult(getConfig(req.params.config), res);
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
  let config = { };
  let action = 'show';
  logConsole.info('post: ' + req.params.config + ' ' + req.params.action);
  if (req.params.config) {
    if (fs.existsSync(path.join(configDir, req.params.config + '.js'))) {
      config = getConfig(req.params.config);
    } else {
      config.error = 'config file not found ./config/' + req.params.config + '.js';
      logConsole.info('config file not found: ./config/' + req.params.config + '.js');
    }
    if (req.params.action) {
      action = req.params.action;
      if (action == 'edit' && req.body.configfile) {
        storeConfig(config, req.body.configfile);
        action = 'check';
      } else {
        logConsole.info('not written: ' + configDir + '/' + config.name + '.js\n' +
            JSON.stringify(req.body, null, 4));
        action = '';
      }
    }
  }
  res.render('appView.ejs', {
    configs: configs,
    config: config,
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
  fs.readdirSync(configDir).forEach((fileName) => { // jscs:ignore jsDoc
    const configName = fileName.replace(/\.js/, '');
    configs.push(getItem(configName));
  });
  configs.forEach((config) => { // jscs:ignore jsDoc
    config.result = getResult(config.data.destDir);
    getSummary(config);
  });
  return configs;
}

/**
 * get full config info
 *
 * @param {String} configName - base name of configuration file
 */
function getItem(configName) {
  let config = { name: configName };
  config.data = getConfigData(configName);
  config.lastRun = 'Keine Daten';
  try {
    const fileStat = fs.statSync(path.join(resultsDir, config.data.destDir, 'index.json'));
    config.lastRun = dateFormat(fileStat.mtime, 'dd.mm.yyyy, HH:MM:ss');
  } catch (err) {
    if (err.length > 0 && err.code != 'ENOENT') {
      logConsole.info(configName + ' error: ' + JSON.stringify(err, null, 4));
    }
  }
  return config;
}

/**
 * get data for config
 *
 * @param {String} configName - base name of configuration file
 */
function getConfig(configName) {
  let config = { name: configName };
  config.file = getConfigFile(configName);
  config.data = getConfigData(configName);
  try {
    const fileStat = fs.statSync(path.join(resultsDir, config.data.destDir, 'index.json'));
    config.lastRun = dateFormat(fileStat.mtime, 'dd.mm.yyyy, HH:MM:ss');
  } catch (err) {
    config.lastRun = 'Keine Daten im Verzeichnis ./results';
    if (err.length > 0 && err.code != 'ENOENT') {
      logConsole.info(configName + ' error: ' + JSON.stringify(err, null, 4));
    }
  }
  if (config.data.destDir) {
    config.logfile = getLogfile(config.data.destDir);
    config.result = getResult(config.data.destDir);
  }
  return config;
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
    //config.error = err;
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
    logConsole.info('compare file found: ' + filename);
  } catch (err) {
    logConsole.info('compare file not found: ' + filename);
    // probably file not found
  }
  return result;
}

/**
 * calculate result summary
 *
 * @param {Object} config - configuration
 */
function getSummary(config) {
  config.success = true;
  config.totalTests = 0;
  config.failedTests = 0;
  Object.keys(config.result).forEach((key) => { // jscs:ignore jsDoc
    if (!config.result[key].success) {
      config.success = false;
      config.failedTests++;
    }
    config.totalTests++;
  });
}

/**
 * start compare-layouts with config file
 *
 * @param {Object} config - configuration
 * @param {Boolean} verbose - make more output
 * @param {Object} res - result
 */
function runConfigAsync(config, verbose, res) {
  const destDir = path.join(__dirname, 'results', config.data.destDir);
  const logfilePath = path.join(destDir, 'console.log');
  const log = (msg) => { // jscs:ignore jsDoc
    logConsole.info(msg);
    fs.appendFileSync(logfilePath, msg + '\n');
    res.write(replaceAnsiColors(msg) + '\n');
  };
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
  }
  log('server started ' + config.name);
  running.push(config.name);
  if (fs.existsSync(logfilePath)) {
    fs.unlinkSync(logfilePath);
  }
  const configFilename = config.name + '.js';
  const loader = exec('node index.js ' + configFilename + (verbose ? ' -v' : ''));
  loader.stdout.on('data', (data) => { log(data.toString().trim()); }); // jscs:ignore jsDoc
  loader.stderr.on('data', (data) => { log(data.toString().trim()); }); // jscs:ignore jsDoc
  loader.on('error', (err) => { log(' error: ' + err.toString().trim()); }); // jscs:ignore jsDoc
  loader.on('close', (code) => { // jscs:ignore jsDoc
    if (code > 0) {
      log('load ' + config.name + ' error, exit-code: ' + code);
    }
    log('server finished ' + config.name);
    running.splice(running.indexOf(config.name), 1);
    if (running.length === 0) {
      res.end();
    }
  });
}

/**
 * delete results directory
 *
 * @param {Object} config - configuration
 * @param {Object} res - result
 */
function clearResult(config, res) {
  const destDir = path.join(__dirname, 'results', config.data.destDir);
  const log = (msg) => { // jscs:ignore jsDoc
    logConsole.info(msg);
    res.write(replaceAnsiColors(msg) + '\n');
  };
  if (fs.existsSync(destDir)) {
    fsTools.removeSync(destDir);
  }
  log('Ergebnisse gelöscht für ' + config.name);
  res.end();
}

/**
 * save configuration
 *
 * @param {Object} config - configuration
 * @param {Object} configData - data
 */
function storeConfig(config, configData) {
  fs.writeFileSync(configDir + '/' + config.name + '.js', configData, 0);
  logConsole.info('written: ' + configDir + '/' + config.name + '.js');
  config.file = getConfigFile(config.name);
  config.data = getConfigData(config.name);
  if (config.data.length === 0) {
    config.error = 'Syntax error in config file.';
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
