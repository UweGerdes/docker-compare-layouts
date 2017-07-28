/*
 * gulpfile for compare-layouts
 *
 * (c) Uwe Gerdes, entwicklung@uwegerdes.de
 */
'use strict';

var exec = require('child_process').exec,
	del = require('del'),
	fs = require('fs'),
	glob = require('glob'),
	gulp = require('gulp'),
	autoprefixer = require('gulp-autoprefixer'),
	server = require('gulp-develop-server'),
	jshint = require('gulp-jshint'),
	lessChanged = require('gulp-less-changed'),
	less = require('gulp-less'),
	lesshint = require('gulp-lesshint'),
	gulpLivereload = require('gulp-livereload'),
	notify = require('gulp-notify'),
	postMortem = require('gulp-postmortem'),
	uglify = require('gulp-uglify'),
	gutil = require('gulp-util'),
	path = require('path'),
	os = require('os'),
	rename = require('rename'),
	runSequence = require('run-sequence')
	;

var baseDir = __dirname;
var testLogfile = path.join(baseDir, 'tests.log');
var testHtmlLogfile = path.join(baseDir, 'tests.html');
var logMode = 0;
var txtLog = [];
var htmlLog = [];
var watchFilesFor = {};
var lifereloadPort = process.env.GULP_LIVERELOAD || 5082;

/*
 * log only to console, not GUI
 */
var log = notify.withReporter(function (options, callback) {
	callback();
});

/*
 * less files lint and style check
 */
watchFilesFor['less-lint'] = [
	path.join(baseDir, 'less', '**', '*.less')
];
gulp.task('less-lint', function () {
	return gulp.src( watchFilesFor['less-lint'] )
		.pipe(lesshint())  // enforce style guide
		.on('error', function (err) {})
		.pipe(lesshint.reporter())
		;
});

watchFilesFor.less = [
	path.join(baseDir, 'less', '**', '*.less'),
	path.join(baseDir, 'less', 'app.less')
];
gulp.task('less', function () {
	var dest = function(filename) {
		return path.join(path.dirname(path.dirname(filename)), 'css');
	};
	var src = watchFilesFor.less.filter(function(el){return el.indexOf('/**/') == -1; });
	return gulp.src( src )
		.pipe(lessChanged({
			getOutputFileName: function(file) {
				return rename( file, { dirname: dest(file), extname: '.css' } );
			}
		}))
		.pipe(less())
		.on('error', log.onError({ message:  'Error: <%= error.message %>' , title: 'LESS Error'}))
		.pipe(autoprefixer('last 3 version', 'safari 5', 'ie 8', 'ie 9', 'ios 6', 'android 4'))
		.pipe(gutil.env.type === 'production' ? uglify() : gutil.noop())
		.pipe(gulp.dest(function(file) { return dest(file.path); }))
		.pipe(log({ message: 'written: <%= file.path %>', title: 'Gulp less' }))
		;
});

/*
 * jshint javascript files
 */
watchFilesFor.jshint = [
	path.join(baseDir, 'package.json'),
	path.join(baseDir, '**', '*.js')
];
gulp.task('jshint', function(callback) {
	return gulp.src(watchFilesFor.jshint)
		.pipe(jshint())
		.pipe(jshint.reporter('default'))
		;
});

watchFilesFor['compare-layouts-default'] = [
	path.join(baseDir, 'config', 'default.js'),
	path.join(baseDir, 'index.js'),
	path.join(baseDir, 'bin', 'load-page.js')
];
gulp.task('compare-layouts-default', function(callback) {
	del( [
			path.join(baseDir, 'results', 'default', '*.png'),
			path.join(baseDir, 'results', 'default', '*.css.json')
		], { force: true } );
	var loader = exec('node index.js config/default.js',
		{ cwd: baseDir },
		function (err, stdout, stderr) {
			logExecResults(err, stdout, stderr);
			callback();
		}
	);
	loader.stdout.on('data', function(data) { if(!data.match(/PASS/)) { console.log(data.trim()); } });
});

// helper functions
var logExecResults = function (err, stdout, stderr) {
	logTxt (stdout.replace(/\u001b\[[^m]+m/g, '').match(/[^\n]*FAIL [^\n]+/g));
	logHtml(stdout.replace(/\u001b\[[^m]+m/g, '').match(/[^\n]*FAIL [^0-9][^\n]+/g));
	if (err) {
		console.log('error: ' + err.toString());
	}
};

var logTxt = function (msg) {
	if (logMode === 1 && msg){
		var txtMsg = msg.join('\n');
		txtLog.push(txtMsg);
	}
};

var logHtml = function (msg) {
	if (logMode === 1 && msg){
		var htmlMsg = msg.join('<br />')
						.replace(/FAIL ([^ ]+) ([^ :]+)/, 'FAIL ./results/$1/$22.png')
						.replace(/([^ ]+\/[^ ]+\.png)/g, '<a href="$1">$1</a>');
		var errorClass = htmlMsg.indexOf('FAIL') > -1 ? ' class="fail"' : ' class="success"';
		htmlLog.push('\t<li' + errorClass + '>' + htmlMsg + '</li>');
	}
};

var writeTxtLog = function () {
	if (txtLog.length > 0) {
		fs.writeFileSync(testLogfile, txtLog.join('\n') + '\n');
	}
};

var writeHtmlLog = function () {
	if (htmlLog.length > 0) {
		var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8" />\n' +
				'<title>Testergebnisse</title>\n' +
				'<link href="compare-layouts/css/index.css" rel="stylesheet" />\n' +
				'</head>\n<body><h1>Testergebnisse</h1>\n<ul>\n';
		html += htmlLog.join('\n');
		html += '</ul>\n</body>\n</html>';
		fs.writeFileSync(testHtmlLogfile, html);
	}
};

gulp.task('clearTestLog', function() {
	del([ testLogfile, testHtmlLogfile ], { force: true });
	logMode = 1;
});

gulp.task('logTestResults', function(callback) {
	if (txtLog.length > 0) {
		console.log('######################## TEST RESULTS ########################');
		console.log(txtLog.join('\n'));
	} else {
		console.log('######################## TEST SUCCESS ########################');
		logTxt (['SUCCESS gulp tests']);
	}
	writeTxtLog();
	writeHtmlLog();
	logMode = 0;
	callback();
});

// start responsive-check server
gulp.task('server:start', function() {
	server.listen({
			path: path.join(baseDir, 'server.js'),
			env: { GULP_LIVERELOAD: lifereloadPort, VERBOSE: false },
			cwd: baseDir
		}
	);
});
gulp.task('server:stop', function() {
    server.kill();
});
// restart server if server.js changed
watchFilesFor.server = [
	path.join(baseDir, 'server.js')
];
gulp.task('server', function() {
	server.changed(function(error) {
		if( error ) {
			console.log('responsive-check server.js restart error: ' + JSON.stringify(error, null, 4));
		} else {
			console.log('responsive-check server.js restarted');
			gulp.src(watchFilesFor.server)
				.pipe(gulpLivereload( { quiet: true } ));
		}
	});
});
/*
 * gulp postmortem task to stop server on termination of gulp
 */
gulp.task('server-postMortem', function() {
	return gulp.src( watchFilesFor.server )
		.pipe(postMortem({gulp: gulp, tasks: [ 'server:stop' ]}))
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
gulp.task('livereload', function() {
	gulp.src(watchFilesFor.livereload)
		.pipe(gulpLivereload( { quiet: true } ));
});

/*
 * run all build tasks
 */
gulp.task('build', function(callback) {
	runSequence('less-lint',
		'less',
		'jshint',
		callback);
});

/*
 * watch task
 */
gulp.task('watch', function() {
	Object.keys(watchFilesFor).forEach(function(task) {
		watchFilesFor[task].forEach(function(filename) {
			glob(filename, function(err, files) {
				if (err) {
					console.log(filename + ' error: ' + JSON.stringify(err, null, 4));
				}
				if (files.length === 0) {
					console.log(filename + ' not found');
				}
			});
		});
		gulp.watch( watchFilesFor[task], [ task ] );
	});
	gulpLivereload.listen( { port: lifereloadPort, delay: 2000 } );
	console.log('gulp livereload listening on http://' + ipv4adresses()[0] + ':' + lifereloadPort);
});

/*
 * default task: run all build tasks and watch
 */
gulp.task('default', function(callback) {
	runSequence('build',
		'server:start',
		'watch',
		'server-postMortem',
		callback);
});

function ipv4adresses() {
	var addresses = [];
	var interfaces = os.networkInterfaces();
	for (var k in interfaces) {
		for (var k2 in interfaces[k]) {
			var address = interfaces[k][k2];
			if (address.family === 'IPv4' && !address.internal) {
				addresses.push(address.address);
			}
		}
	}
	return addresses;
}

module.exports = {
	gulp: gulp,
	watchFilesFor: watchFilesFor
};
