/*
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
  server = require('gulp-develop-server'),
  jscs = require('gulp-jscs'),
  jscsStylish = require('gulp-jscs-stylish'),
  jshint = require('gulp-jshint'),
  jsonlint = require('gulp-jsonlint'),
  lessChanged = require('gulp-less-changed'),
  less = require('gulp-less'),
  lesshint = require('gulp-lesshint'),
  gulpLivereload = require('gulp-livereload'),
  notify = require('gulp-notify'),
  postMortem = require('gulp-postmortem'),
  path = require('path'),
  os = require('os'),
  rename = require('rename'),
  runSequence = require('run-sequence')
  ;

const baseDir = __dirname,
  lifereloadPort = process.env.GULP_LIVERELOAD_PORT || 8081;

let watchFilesFor = {};

/*
 * log only to console, not GUI
 */
const log = notify.withReporter((options, callback) => {
  callback();
});

/*
 * less files lint and style check
 */
watchFilesFor['less-lint'] = [
  path.join(baseDir, 'less', '**', '*.less')
];
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
gulp.task('less', () => {
  const dest = (filename) => {
    return path.join(path.dirname(path.dirname(filename)), 'css');
  };
  const src = watchFilesFor.less.filter((el) => { return el.indexOf('**') == -1; });
  return gulp.src(src)
    .pipe(lessChanged({
      getOutputFileName: (file) => {
        return rename(file, { dirname: dest(file), extname: '.css' });
      }
    }))
    .pipe(less())
    .on('error', log.onError({ message:  'Error: <%= error.message %>', title: 'LESS Error' }))
    .pipe(autoprefixer('last 3 version', 'safari 5', 'ie 8', 'ie 9', 'ios 6', 'android 4'))
    .pipe(gulp.dest((file) => { return dest(file.path); }))
    .pipe(log({ message: 'written: <%= file.path %>', title: 'Gulp less' }))
    ;
});

/*
 * jshint javascript files
 */
watchFilesFor.jshint = [
  path.join(baseDir, '**', '*.js')
];
gulp.task('jshint', () => {
  return gulp.src(watchFilesFor.jshint)
    .pipe(jshint())
    .pipe(jscs())
    .pipe(jscsStylish.combineWithHintResults())
    .pipe(jshint.reporter('jshint-stylish'))
    ;
});

/*
 * lint json files
 */
watchFilesFor.jsonlint = [
  path.join(baseDir, '.jshintrc'),
  path.join(baseDir, '.jscsrc'),
  path.join(baseDir, '*.json')
];
gulp.task('jsonlint', function () {
  return gulp.src(watchFilesFor.jsonlint)
    .pipe(jsonlint())
    .pipe(jsonlint.reporter())
    ;
});

watchFilesFor['compare-layouts-default'] = [
  path.join(baseDir, 'config', 'default.js'),
  path.join(baseDir, 'index.js'),
  path.join(baseDir, 'bin', '*.js')
];
gulp.task('compare-layouts-default', (callback) => {
  del([
      path.join(baseDir, 'results', 'default', '*.png'),
      path.join(baseDir, 'results', 'default', '**', 'index.json')
    ], { force: true });
  const loader = exec('node index.js config/default.js', { cwd: baseDir });
  loader.stdout.on('data', (data) => {
    console.log(data.toString().trim());
  });
  loader.stderr.on('data', (data) => {
    console.log('stderr: ' + data.toString().trim());
  });
  loader.on('error', (err) => {
    console.log('error: ' + err.toString().trim());
  });
  loader.on('close', (code) => {
    if (code > 0) {
      console.log('compare-layouts-default exit-code: ' + code);
    }
    callback();
  });
});

// start responsive-check server
gulp.task('server:start', () => {
  server.listen({
      path: path.join(baseDir, 'server.js'),
      env: { GULP_LIVERELOAD: lifereloadPort, VERBOSE: false },
      cwd: baseDir
    }
  );
});
gulp.task('server:stop', () => {
  server.kill();
});

// restart server if server.js changed
watchFilesFor.server = [
  path.join(baseDir, 'server.js')
];
gulp.task('server', () => {
  server.changed((error) => {
    if (error) {
      console.log('responsive-check server.js restart error: ' + JSON.stringify(error, null, 4));
    } else {
      console.log('responsive-check server.js restarted');
      gulp.src(watchFilesFor.server)
        .pipe(gulpLivereload({ quiet: true }));
    }
  });
});

/*
 * gulp postmortem task to stop server on termination of gulp
 */
gulp.task('server-postMortem', () => {
  return gulp.src(watchFilesFor.server)
    .pipe(postMortem({ gulp: gulp, tasks: ['server:stop'] }))
    ;
});

/*
 * livereload server and task
 */
watchFilesFor.livereload = [
  path.join(baseDir, 'views', '*.ejs'),
  path.join(baseDir, 'css', '*.css'),
  path.join(baseDir, 'js', '*.js'),
  path.join(baseDir, 'results', '**', 'index.json')
];
gulp.task('livereload', () => {
  gulp.src(watchFilesFor.livereload)
    .pipe(gulpLivereload({ quiet: true }));
});

/*
 * compare-layouts selftest task
 */
gulp.task('compare-layouts-selftest', (callback) => {
  runSequence('server:start',
    'build',
    'compare-layouts-default',
    'server:stop',
    'compare-layouts-selftest-success',
    callback);
});

/*
 * compare-layouts selftest check result task
 */
gulp.task('compare-layouts-selftest-success', () => {
  if (!fs.existsSync(path.join(baseDir, 'results', 'default', 'index-phantomjs',
      'Desktop', 'body.html'))) {
    throw 'no data files created';
  }
  if (fs.existsSync(path.join(baseDir, 'results', 'default', 'index.json'))) {
    console.log('result summary successfully created (with compare differences)');
  } else {
    console.log('data files created but no result summary created');
  }
});

/*
 * run all build tasks
 */
gulp.task('build', (callback) => {
  runSequence('less-lint',
    'less',
    'jshint',
    'jsonlint',
    callback);
});

/*
 * watch task
 */
gulp.task('watch', () => {
  Object.keys(watchFilesFor).forEach((task) => {
    watchFilesFor[task].forEach((filename) => {
      glob(filename, (err, files) => {
        if (err) {
          console.log(filename + ' error: ' + JSON.stringify(err, null, 4));
        }
        if (files.length === 0) {
          console.log(filename + ' not found');
        }
      });
    });
    gulp.watch(watchFilesFor[task], [task]);
  });
  gulpLivereload.listen({ port: lifereloadPort, delay: 2000 });
  console.log('gulp livereload listening on http://' + ipv4adresses()[0] + ':' + lifereloadPort);
});

/*
 * default task: run all build tasks and watch
 */
gulp.task('default', (callback) => {
  runSequence('build',
    'server:start',
    'watch',
    'server-postMortem',
    callback);
});

// Get IP for console message
// TODO make class
function ipv4adresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (let k in interfaces) {
    if (interfaces.hasOwnProperty(k)) {
      for (let k2 in interfaces[k]) {
        if (interfaces[k].hasOwnProperty(k2)) {
          const address = interfaces[k][k2];
          if (address.family === 'IPv4' && !address.internal) {
            addresses.push(address.address);
          }
        }
      }
    }
  }
  return addresses;
}

module.exports = {
  gulp: gulp,
  watchFilesFor: watchFilesFor
};
