/**
 * gulpfile for compare-layouts
 *
 * (c) Uwe Gerdes, entwicklung@uwegerdes.de
 */
'use strict';

const exec = require('child_process').exec,
  del = require('del'),
  fs = require('fs'),
  glob = require('glob'),
  gulp = require('gulp'),
  autoprefixer = require('gulp-autoprefixer'),
  changedInPlace = require('gulp-changed-in-place'),
  server = require('gulp-develop-server'),
  jscs = require('gulp-jscs'),
  jscsStylish = require('gulp-jscs-stylish'),
  jshint = require('gulp-jshint'),
  jsonlint = require('gulp-jsonlint'),
  lessChanged = require('gulp-less-changed'),
  less = require('gulp-less'),
  lesshint = require('gulp-lesshint'),
  livereload = require('gulp-livereload'),
  notify = require('gulp-notify'),
  postMortem = require('gulp-postmortem'),
  path = require('path'),
  rename = require('rename'),
  runSequence = require('run-sequence'),
  ejslint = require('./bin/ejslint.js'),
  ipv4addresses = require('./bin/ipv4addresses.js'),
  logConsole = require('./bin/log.js')
  ;

const baseDir = __dirname,
  lifereloadPort = process.env.GULP_LIVERELOAD_PORT || 8081;

let watchFilesFor = {};

watchFilesFor['less-lint'] = [
  path.join(baseDir, 'less', '**', '*.less')
];
/**
 * less-lint: files lint and style check
 */
gulp.task('less-lint', () => {
  return gulp.src(watchFilesFor['less-lint'])
    .pipe(lesshint())
    .on('error', log.onError({ message:  'Error: <%= error.message %>', title: 'LESS Error' }))
    .pipe(lesshint.reporter())
    ;
});

watchFilesFor.less = [
  path.join(baseDir, 'less', 'app.less'),
  path.join(baseDir, 'less', '**', '*.less')
];
/**
 * less: generate css from less
 */
gulp.task('less', () => {
  const dest = (filename) => { // jscs:ignore jsDoc
    return path.join(path.dirname(path.dirname(filename)), 'css');
  };
  const src = watchFilesFor.less.filter((el) => { // jscs:ignore jsDoc
    return el.indexOf('**') == -1;
  });
  return gulp.src(src)
    .pipe(lessChanged({
      getOutputFileName: (file) => { // jscs:ignore jsDoc
        return rename(file, { dirname: dest(file), extname: '.css' });
      }
    }))
    .pipe(less())
    .on('error', log.onError({ message:  'Error: <%= error.message %>', title: 'LESS Error' }))
    .pipe(autoprefixer('last 3 version', 'safari 5', 'ie 8', 'ie 9', 'ios 6', 'android 4'))
    .pipe(gulp.dest((file) => { // jscs:ignore jsDoc
      return dest(file.path);
    }))
    .pipe(log({ message: 'written: <%= file.path %>', title: 'Gulp less' }))
    ;
});

watchFilesFor.jshint = [
  path.join(baseDir, '*.js'),
  path.join(baseDir, 'bin', '*.js'),
  path.join(baseDir, 'config', '*.js'),
  path.join(baseDir, 'js', '*.js')
];
/**
 * jshint: javascript files
 */
gulp.task('jshint', () => {
  return gulp.src(watchFilesFor.jshint)
    .pipe(changedInPlace({ howToDetermineDifference: 'modification-time' }))
    .pipe(jshint())
    .pipe(jscs())
    .pipe(jscsStylish.combineWithHintResults())
    .pipe(jshint.reporter('jshint-stylish'))
    ;
});

watchFilesFor.jsonlint = [
  path.join(baseDir, '.jshintrc'),
  path.join(baseDir, '.jscsrc'),
  path.join(baseDir, '*.json')
];
/**
 * jsonlint: lint json files
 */
gulp.task('jsonlint', () => {
  return gulp.src(watchFilesFor.jsonlint)
    .pipe(jsonlint())
    .pipe(jsonlint.reporter())
    ;
});

watchFilesFor.ejslint = [
  path.join(baseDir, 'views', '**', '*.ejs')
];
/**
 * jsonlint: lint ejs files
 *
 * @param {function} callback - gulp callback
 */
gulp.task('ejslint', (callback) => {
  ejslint.ejslint(watchFilesFor.ejslint, callback);
});

watchFilesFor['compare-layouts-default'] = [
  path.join(baseDir, 'config', 'default.js'),
  path.join(baseDir, 'index.js'),
  path.join(baseDir, 'bin', 'load-poage-styles.js'),
  path.join(baseDir, 'bin', 'style-tree.js')
];
/**
 * compare-layouts-default: test task
 *
 * @param {function} callback - gulp callback
 */
gulp.task('compare-layouts-default', (callback) => {
  const resultsDir = path.join('results', 'default');
  del([
      path.join(baseDir, resultsDir, '*.png'),
      path.join(baseDir, resultsDir, '**', 'index.json')
    ], { force: true });
  const loader = exec('node index.js config/default.js', { cwd: baseDir });
  loader.stdout.on('data', (data) => { // jscs:ignore jsDoc
    logConsole.info(data.toString().trim());
  });
  loader.stderr.on('data', (data) => { // jscs:ignore jsDoc
    logConsole.info('stderr: ' + data.toString().trim());
  });
  loader.on('error', (err) => { // jscs:ignore jsDoc
    logConsole.info('error: ' + err.toString().trim());
  });
  loader.on('close', (code) => { // jscs:ignore jsDoc
    if (code > 0) {
      logConsole.info('compare-layouts-default exit-code: ' + code);
    }
    livereload.changed({ path: resultsDir, quiet: true });
    callback();
  });
});

watchFilesFor['test-compare-layouts'] = [
  path.join(baseDir, 'config', 'modules', '**', '*.ejs'),
  path.join(baseDir, 'config', 'modules', '**', 'compare-layouts', '*.js')
];
/**
 * #### testing
 *
 * @param {function} callback - gulp callback
 */
gulp.task('test-compare-layouts', (callback) => {
  getRecentFile(watchFilesFor['test-compare-layouts'])
  .then(getConfig)
  .then(getRequest)
  .then(() => { // jscs:ignore jsDoc
    callback();
  })
  .catch((error) => { // jscs:ignore jsDoc
    console.error('Failed!', error);
    callback();
  });
});

/**
 * get newest file from glob list
 *
 * @param {array} paths - list with glob paths
 */
function getRecentFile(paths) {
  let newest = null;
  let bestTime = 0;
  paths.forEach((path) => { // jscs:ignore jsDoc
    const files = glob.sync(path);
    for (let i = 0; i < files.length; i++) {
      const fileTime = fs.statSync(files[i]).mtime.getTime();
      if (fileTime > bestTime) {
        newest = files[i];
        bestTime = fileTime;
      }
    }
  });
  return new Promise((resolve) => { // jscs:ignore jsDoc
    resolve(newest);
  });
}

/**
 * get config for file
 *
 * @param {array} file - list with glob paths
 */
function getConfig(file) {
  return new Promise((resolve, reject) => { // jscs:ignore jsDoc
    const regex = /^.*?(config\/modules\/.+?)\/(?:tests\/compare-layouts|[^/]+)\/([^/]+)\..+$/;
    const match = regex.exec(file);
    const configFile = match[1] + '/tests/compare-layouts/' + match[2] + '.js';
    if (!fs.existsSync(configFile)) {
      reject('no compare-layouts configfile for ' + configFile);
    }
    try {
      const config = require('./' + configFile);
      resolve([configFile, config]);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * get request for config
 *
 * @param {array} data - configFilename and test configuration
 */
function getRequest(data) {
  const configFile = data[0],
    config = data[1];
  return new Promise((resolve, reject) => { // jscs:ignore jsDoc
    const resultsDir = path.join('results', config.destDir);
    del([
        path.join(baseDir, resultsDir, 'console.log'),
        path.join(baseDir, resultsDir, 'index.json')
      ], { force: true });
    const loader = exec('node index.js ' + configFile, { cwd: baseDir });
    loader.stdout.on('data', (data) => { // jscs:ignore jsDoc
      logConsole.info(data.toString().trim());
    });
    loader.stderr.on('data', (data) => { // jscs:ignore jsDoc
      logConsole.info('stderr: ' + data.toString().trim());
    });
    loader.on('error', (err) => { // jscs:ignore jsDoc
      logConsole.info('error: ' + err.toString().trim());
    });
    loader.on('close', (code) => { // jscs:ignore jsDoc
      if (code > 0) {
        logConsole.info('compare-layouts-default exit-code: ' + code);
        reject('compare-layouts-default exit-code: ' + code + ', start verbose to see more');
      }
      livereload.changed({ path: resultsDir, quiet: true });
      resolve(data);
    });
  });
}

/**
 * server:start
 */
gulp.task('server:start', () => {
  server.listen({
      path: path.join(baseDir, 'server.js'),
      env: { GULP_LIVERELOAD: lifereloadPort, VERBOSE: false, FORCE_COLOR: 1 },
      cwd: baseDir
    }
  );
});

/**
 * server:stop
 */
gulp.task('server:stop', () => {
  server.kill();
});

watchFilesFor.server = [
  path.join(baseDir, 'server.js'),
  path.join(baseDir, 'bin', 'ipv4addresses.js'),
  path.join(baseDir, 'bin', 'log.js'),
  path.join(baseDir, 'bin', 'obj2html.js')
];
/**
 * server: restart if server.js changed
 */
gulp.task('server', () => {
  server.changed((error) => { // jscs:ignore jsDoc
    if (error) {
      logConsole.info('server.js restart error: ' + JSON.stringify(error, null, 4));
    } else {
      logConsole.info('server.js restarted');
      gulp.src(watchFilesFor.server)
        .pipe(livereload({ quiet: true }));
    }
  });
});

/**
 * server-postMortem: stop server on termination of gulp
 */
gulp.task('server-postMortem', () => {
  return gulp.src(watchFilesFor.server)
    .pipe(postMortem({ gulp: gulp, tasks: ['server:stop'] }))
    ;
});

watchFilesFor.livereload = [
  path.join(baseDir, 'views', '*.ejs'),
  path.join(baseDir, 'css', '*.css'),
  path.join(baseDir, 'js', '*.js')
];
/**
 * livereload: watch task
 */
gulp.task('livereload', () => {
  gulp.src(watchFilesFor.livereload)
    .pipe(livereload({ quiet: true }));
});

/**
 * compare-layouts-selftest: start server, build, run test, stop server, check result
 *
 * @param {function} callback - gulp callback
 */
gulp.task('compare-layouts-selftest', (callback) => {
  runSequence('server:start',
    'build',
    'compare-layouts-default',
    'server:stop',
    'compare-layouts-selftest-success',
    callback);
});

/**
 * compare-layouts-selftest-success: check result task
 */
gulp.task('compare-layouts-selftest-success', () => {
  if (!fs.existsSync(path.join(baseDir, 'results', 'default', 'index-phantomjs',
      'Desktop', 'body.html'))) {
    throw 'no data files created';
  }
  if (fs.existsSync(path.join(baseDir, 'results', 'default', 'index.json'))) {
    logConsole.info('result summary successfully created (with compare differences)');
  } else {
    console.error('ERROR: no result summary created');
    process.exitCode = 1;
  }
});

/**
 * build: run all build tasks
 *
 * @param {function} callback - gulp callback
 */
gulp.task('build', (callback) => {
  runSequence('less-lint',
    'less',
    'jshint',
    'jsonlint',
    callback);
});

/**
 * watch: everything in watchFilesFor, start livereload server
 */
gulp.task('watch', () => {
  Object.keys(watchFilesFor).forEach((task) => { // jscs:ignore jsDoc
    watchFilesFor[task].forEach((filename) => { // jscs:ignore jsDoc
      glob(filename, (err, files) => { // jscs:ignore jsDoc
        if (err) {
          logConsole.info(filename + ' error: ' + JSON.stringify(err, null, 4));
        }
        if (files.length === 0) {
          logConsole.info(filename + ' not found');
        }
      });
    });
    gulp.watch(watchFilesFor[task], [task]);
  });
  livereload.listen({ port: lifereloadPort, delay: 2000 });
  logConsole.info('gulp livereload listening on http://' +
    ipv4addresses.get()[0] + ':' + lifereloadPort);
});

/**
 * default: run all build tasks and watch
 *
 * @param {function} callback - gulp callback
 */
gulp.task('default', (callback) => {
  runSequence('build',
    'server:start',
    'watch',
    'server-postMortem',
    callback);
});

/**
 * helper function: log only to console, not GUI
 *
 * @param {Object} options - configuration
 * @param {function} callback - gulp callback
 */
const log = notify.withReporter((options, callback) => {
  callback();
});

module.exports = {
  gulp: gulp,
  watchFilesFor: watchFilesFor
};
