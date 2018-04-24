/*
 * HTTP-Server for compare-layouts
 *
 * (c) Uwe Gerdes, entwicklung@uwegerdes.de
 */
'use strict';

const fs = require('fs'),
  fsTools = require('fs-tools'),
  path = require('path'),
  exec = require('child_process').exec,
  express = require('express'),
  bodyParser = require('body-parser'),
  logger = require('morgan'),
  dateFormat = require('dateformat'),
  _eval = require('eval'),
  ipv4addresses = require('./bin/ipv4addresses.js'),
  obj2html = require('./bin/obj2html.js'),
  app = express();

const livereloadPort = process.env.GULP_LIVERELOAD_PORT || 8081,
  httpPort = process.env.COMPARE_LAYOUTS_HTTP || 8080;

const configDir = path.join(__dirname, 'config'),
  resultsDir = path.join(__dirname, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

let running = [],
  configs = [];

// Log the requests
app.use(logger('dev'));

// work on post requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(__dirname));

// Handle requests for app view
app.get('/app/:config?/:action?/:param?', (req, res) => {
  const list = getList(res);
  let config = { };
  let action = 'show';
  if (req.params.config) {
    if (fs.existsSync(path.join(configDir, req.params.config + '.js'))) {
      config = getConfig(req.params.config);
    } else {
      config.error = 'config file not found: ./config/' + req.params.config + '.js';
      console.log('config file not found: ./config/' + req.params.config + '.js');
    }
    if (req.params.action) {
      action = req.params.action;
    }
  }
  res.render('appView.ejs', {
    list: list,
    config: config,
    action: action,
    livereloadPort: livereloadPort,
    httpPort: httpPort,
    running: running
  });
});

// Handle requests for app view
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

// Handle AJAX requests for run configs
app.get('/run/:config/:verbose?', (req, res) => {
  console.log('starting ' + req.params.config);
  if (req.params.config == 'all') {
    configs.forEach((config) => {
      runConfigAsync(config, req.params.verbose, res);
    });
  } else {
    runConfigAsync(getConfig(req.params.config), req.params.verbose, res);
  }
});

// Handle AJAX requests for run configs
app.get('/clear/:config', (req, res) => {
  if (req.params.config == 'all') {
    configs.forEach((config) => {
      clearResult(config, res);
    });
  } else {
    clearResult(getConfig(req.params.config), res);
  }
});

// Route for root dir
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for everything else.
app.get('*', (req, res) => {
  res.status(404).send('Sorry cant find that: ' + req.url);
});

// Handle form POST requests for app view
app.post('/app/:config?/:action?', (req, res) => {
  const list = getList(res);
  let config = { };
  let action = 'show';
  console.log('post: ' + req.params.config + ' ' + req.params.action);
  if (req.params.config) {
    if (fs.existsSync(path.join(configDir, req.params.config + '.js'))) {
      config = getConfig(req.params.config);
    } else {
      config.error = 'config file not found ./config/' + req.params.config + '.js';
      console.log('config file not found: ./config/' + req.params.config + '.js');
    }
    if (req.params.action) {
      action = req.params.action;
      if (action == 'edit' && req.body.configfile) {
        storeConfig(config, req.body.configfile);
        action = 'check';
      } else {
        console.log('not written: ' + configDir + '/' + config.name + '.js\n' +
            JSON.stringify(req.body, null, 4));
        action = '';
      }
    }
  }
  res.render('appView.ejs', {
    list: list,
    config: config,
    action: action,
    livereloadPort: livereloadPort,
    httpPort: httpPort,
    running: running
  });
});

// Fire it up!
app.listen(httpPort);
console.log('compare-layouts server listening on http://' +
  ipv4addresses.get()[0] + ':' + httpPort);

// Model //
// get list of configurations and result status
function getList() {
  configs = [];
  fs.readdirSync(configDir).forEach((fileName) => {
    const configName = fileName.replace(/\.js/, '');
    configs.push(getItem(configName));
  });
  configs.forEach((config) => {
    config.result = getResult(config.data.destDir);
    getSummary(config);
  });
  return configs;
}

// get full config info
function getItem(configName) {
  let config = { name: configName };
  config.data = getConfigData(configName);
  config.lastRun = 'Keine Daten';
  try {
    const fileStat = fs.statSync(path.join(resultsDir, config.data.destDir, 'index.json'));
    config.lastRun = dateFormat(fileStat.mtime, 'dd.mm.yyyy, HH:MM:ss');
  } catch (err) {
    if (err.length > 0 && err.code != 'ENOENT') {
      console.log(configName + ' error: ' + JSON.stringify(err, null, 4));
    }
  }
  return config;
}

// get data for config
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
      console.log(configName + ' error: ' + JSON.stringify(err, null, 4));
    }
  }
  if (config.data.destDir) {
    config.logfile = getLogfile(config.data.destDir);
    config.result = getResult(config.data.destDir);
  }
  return config;
}

// get content of config file
function getConfigFile(configName) {
  let content = 'not found';
  const configPath = path.join(configDir, configName + '.js');
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath).toString();
  }
  return content;
}

// get data from config file
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

// get log file content
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

// get result data
function getResult(destDir) {
  let result = { };
  try {
    result = JSON.parse(fs.readFileSync(path.join(resultsDir, destDir, 'index.json')));
  } catch (err) {
    // probably file not found
  }
  return result;
}

// get compare data
function getCompare(destDir, compare, viewport) {
  const filename = path.join(resultsDir, destDir, compare, viewport + '.json');
  let result = { };
  try {
    result = JSON.parse(fs.readFileSync(filename));
    console.log('compare file found: ' + filename);
  } catch (err) {
    console.log('compare file not found: ' + filename);
    // probably file not found
  }
  return result;
}

// calculate result summary
function getSummary(config) {
  config.success = true;
  config.totalTests = 0;
  config.failedTests = 0;
  Object.keys(config.result).forEach((key) => {
    if (!config.result[key].success) {
      config.success = false;
      config.failedTests++;
    }
    config.totalTests++;
  });
}

// start compare-layouts with config file
function runConfigAsync(config, verbose, res) {
  const destDir = path.join(__dirname, 'results', config.data.destDir);
  const logfilePath = path.join(destDir, 'console.log');
  const log = (msg) => {
    console.log(msg);
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
  const configFilename = 'config/' + config.name + '.js';
  const loader = exec('node index.js ' + configFilename + (verbose ? ' -v' : ''));
  loader.stdout.on('data', (data) => { log(data.toString().trim()); });
  loader.stderr.on('data', (data) => { log(data.toString().trim()); });
  loader.on('error', (err) => { log(' error: ' + err.toString().trim()); });
  loader.on('close', (code) => {
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

// delete results directory
function clearResult(config, res) {
  const destDir = path.join(__dirname, 'results', config.data.destDir);
  const log = (msg) => {
    console.log(msg);
    res.write(replaceAnsiColors(msg) + '\n');
  };
  if (fs.existsSync(destDir)) {
    fsTools.removeSync(destDir);
  }
  log('Ergebnisse gelöscht für ' + config.name);
  res.end();
}

function storeConfig(config, configData) {
  fs.writeFileSync(configDir + '/' + config.name + '.js', configData, 0);
  console.log('written: ' + configDir + '/' + config.name + '.js');
  config.file = getConfigFile(config.name);
  config.data = getConfigData(config.name);
  if (config.data.length === 0) {
    config.error = 'Syntax error in config file.';
  }
}

// TOTO make module
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
  string.toString().split(/(\x1B\[[0-9;]+m)/).forEach((part) => {
    if (part.match(/(\x1B\[[0-9;]+m)/)) {
      part = part.replace(/\x1B\[([0-9;]+)m/, '$1');
      if (part == '0') {
        result += '</span>';
      } else {
        result += '<span style="';
        part.split(/(;)/).forEach((x) => {
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
