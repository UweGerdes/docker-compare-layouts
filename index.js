/*
 * Laden von Styledaten von zwei HTML-Seiten vom Browser
 * und Vergleich von HTML-Styles für Regressions- und Back-to-Back-Tests
 *
 * node compare-layouts.js [configfile] [-v] [-r]
 *
 * configfile: config/name.js erwartet, Beispiele in ./config
 * -v: verbose
 * -r: force reload / ignore cache
 *
 * (c) Uwe Gerdes, entwicklung@uwegerdes.de
 */
'use strict';

var fs = require('fs'),
	exec = require('child_process').exec,
	path = require('path'),
	styleTree = require('./bin/style-tree.js');

var configFile = 'config/default.js',
	config = null;

if (process.argv[2]) {
	configFile = process.argv[2];
}
config = require('./' + configFile);

var reload = process.argv.indexOf('-r') > -1;
if (reload) {
	console.log('forced reload');
}

var verbose = process.argv.indexOf('-v') > -1;

var resultsDir = './results';
var destDir = path.join(resultsDir, config.destDir);
var pages = config.pages;
var compares = config.compares;
var pagesLoaded = 0;
//var pagesExpected = [];
//var pagesLoaded = [];

if (!fs.existsSync(resultsDir)) {
	fs.mkdirSync(resultsDir);
}
fs.stat(destDir, function(err, stats) {
	if (!stats) {
		fs.mkdir(destDir,
			function (err, data) {
				if (err) { throw err; }
				if (data) {console.log(data); }
				console.log('directory "' + destDir + '" created');
				load();
			}
		);
		console.log('creating directory "' + destDir + '"');
	} else {
		if (!stats.isDirectory()) {
			console.log(destDir + ' exists but is not a directory');
		} else {
			load();
			comparePages(); // cache-cache compare (for developement)
		}
	}
});

// the working directory has changed to data directory
function load() {
	Object.keys(pages).forEach(function(pageKey) {
		var page = pages[pageKey];
		var selectorList;
		if (page.selectorList) {
			selectorList = page.selectorList;
		} else {
			selectorList = page.selector.split(/,/);
		}
		if (reload || !page.cache || !isCached(destDir + '/' + pageKey, selectorList)) {
			loadPage(configFile, pageKey, page);
		} else {
			pagesLoaded++;
		}

//		config.viewports.forEach(function(viewport) {
//			pagesExpected.push(getPageKey(engine, viewport.name));
//			loadPage(config, engine, viewport, addResult);
//		});
	});
}

function loadPage(configFile, pageKey, page) {
	page.loaded = false;
	var args = ['./bin/load-page-styles.js',
		'--configFile="' + configFile + '"',
		'--pageKey="' + pageKey + '"'];
	var cmd = 'casperjs';
	if (page.engine) {
		args.unshift('--engine="' + page.engine + '"');
		if (page.engine == 'slimerjs') {
//			cmd = 'xvfb-run -a -e /dev/stdout casperjs';
			cmd = 'xvfb-run -a casperjs';
		}
	}
	console.log('starting: ' + cmd + ' ' + args.join(' '));
	var loader = exec(cmd + ' ' + args.join(' '),
		function (error, stdout, stderr) {
			logExecResult('loaded page ' + page.url, error, "", stderr);
		}
	);
	loader.stdout.on('data', function(data) { if (verbose || data.indexOf('element not found') > -1) {console.log(pageKey + ': ' + data.trim());} });
	loader.stderr.on('data', function(data) { console.log(pageKey + ' stderr: ' + data.trim()); });
	loader.on('error', function(err) { console.log(pageKey + ' error: ' + err.trim()); });
	loader.on('close', function(code) {
		if (code > 0) {
			console.log('load ' + page.url + ' exit: ' + code);
		}
		page.loaded = true;
		pagesLoaded++;
		comparePages();
	});
}

var success = true;
var pagesLoading = [];
function comparePages() {
	if (pagesLoaded < Object.keys(pages).length) {
		return;
	}
	var results = {};
	Object.keys(compares).forEach(function(key) {
		console.log('compare ' + key);
		var compare = compares[key];
		var page1 = pages[compare.page1];
		var page2 = pages[compare.page2];
		Object.keys(config.widths).forEach(function(widthKey) {
			var width = config.widths[widthKey];
			console.log('compare ' + key + ', width: ' + width);
			var result = {};
			result.name = key;
			result.width = width;
			result.page1 = page1;
			result.page2 = page2;
			result.subdir1 = compare.page1;
			result.subdir2 = compare.page2;
			result.selector1 = compare.selector1 ? compare.selector1 : page1.selector;
			result.selector2 = compare.selector2 ? compare.selector2 : page2.selector;
			result.baseFilename1 = destDir + '/' + width + '/' + compare.page1 + '/' + safeFilename(result.selector1);
			result.baseFilename2 = destDir + '/' + width + '/' + compare.page2 + '/' + safeFilename(result.selector2);
			result.exists1 = chkCacheFile(result.baseFilename1 + '.json');
			result.exists2 = chkCacheFile(result.baseFilename2 + '.json');
			result.success = false;
			if ((page1.cache || page1.loaded) && result.exists1 &&
				(page2.cache || page2.loaded) && result.exists2) {
				pagesLoading.push(key);
				result.success = true;
				result.compareFilename = destDir + '/' + width + '/' + safeFilename(key) + '_compare.png';
				result.compositeFilename = destDir + '/' + width + '/' + safeFilename(key) + '_composite.png';
				result.compositeMonochromeFilename = destDir + '/' + width + '/' + safeFilename(key) + '_composite_monochrome.png';
				result.jsonFilename = destDir + '/' + width + '/' + safeFilename(key) + '.json';
				result.htmlFilename = destDir + '/' + width + '/' + safeFilename(key) + '.html';
				exec('compare -metric AE ' + result.baseFilename1 + '.png ' + result.baseFilename2 + '.png ' + result.compareFilename,
					function (error, stdout, stderr) {
						if (verbose) { logExecResult('compare', null, stdout, stderr.replace(/ @.+/, '').replace(/^0$/, '')); }
						if (stderr == '0') {
							if (verbose) { console.log(result.compareFilename + ' saved'); }
						} else {
							result.success = false;
							success = false;
						}
			console.log('compare ' + result.baseFilename1 + ' / ' + result.baseFilename2);
						result.imageStderr = stderr;
						exec('composite -compose difference ' + result.baseFilename1 + '.png ' + result.baseFilename2 + '.png ' + result.compositeFilename,
							function (error, stdout, stderr) {
								logExecResult('composite', null, stdout, stderr.replace(/ @.+/, ''));
								if (stderr.length === 0) {
									if (verbose) { console.log(result.compositeFilename + ' saved'); }
								} else {
									result.compositeFilename = '';
									result.success = false;
									success = false;
								}
								exec('composite -compose difference -monochrome ' + result.baseFilename2 + '.png ' + result.baseFilename2 + '.png ' + result.compositeMonochromeFilename,
									function (error, stdout, stderr) {
										logExecResult('composite -monochrome', null, stdout, stderr.replace(/ @.+/, ''));
										if (stderr.length === 0) {
											if (verbose) { console.log(result.compositeMonochromeFilename + ' saved'); }
										} else {
											result.compositeMonochromeFilename = '';
											result.success = false;
											success = false;
										}
										compareResults(compare, key);
										pagesLoading.splice(pagesLoading.indexOf(key), 1);
										if (pagesLoading.length === 0) {
											fs.writeFile(destDir + '/' + 'index.json', JSON.stringify(results, null, 4), 0);
											console.log((success ? "SUCCESS" : "FAIL") + ' compare-layouts/' + destDir + '/index.json');
										}
									}
								);
							}
						);
					}
				);
			} else {
				console.log('loaded pages not found');
			}
			results[key + '_' + width] = result;
		});
	});
}

function compareResults(compare, name) {
	var page1 = pages[compare.page1];
	var selector1 = compare.selector1 ? compare.selector1 : page1.selector;
	var page2 = pages[compare.page2];
	var selector2 = compare.selector2 ? compare.selector2 : page2.selector;
	var result = true;
				console.log('comparing ' + selector1);
	config.widths.forEach(function(width) {
		if (chkCacheFile(destDir + '/' + width + '/' + compare.page1 + '/' + safeFilename(selector1) + '.json') &&
			chkCacheFile(destDir + '/' + width + '/' + compare.page2 + '/' + safeFilename(selector2) + '.json')) {
			var styleTree1 = styleTree(JSON.parse(fs.readFileSync(destDir + '/' + width + '/' + compare.page1 + '/' + safeFilename(selector1) + '.json')));
			var styleTree2 = styleTree(JSON.parse(fs.readFileSync(destDir + '/' + width + '/' + compare.page2 + '/' + safeFilename(selector2) + '.json')));
			var compareResult = styleTree1.compareTo(styleTree2, compare.compare);
			var jsonFilename = destDir + '/' + width + '/' + safeFilename(name) + '.json';
			fs.writeFile(jsonFilename, JSON.stringify(compareResult, undefined, 4), 0);
			console.log(jsonFilename + ' saved ' + name);
		} else {
			result = false;
		}
	});
	return result;
}

function logExecResult(msgStart, error, stdout, stderr) {
	if (stdout.length > 0) { console.log(msgStart + ' stdout: ' + stdout.trim()); }
	if (stderr.length > 0) { console.log(msgStart + ' stderr: ' + stderr.trim()); }
	if (error !== null)	{ console.log(msgStart + ' error:\n' + JSON.stringify(error, undefined, 4)); }
}

function isCached(subdir, selectorList) {
	var result = true;
	selectorList.forEach(function(selector) {
		if (chkCacheFile(subdir + '/' + safeFilename(selector) + '.json') === false ||
			chkCacheFile(subdir + '/' + safeFilename(selector) + '.png') === false ||
			chkCacheFile(subdir + '/' + safeFilename(selector) + '.html') === false) {
			result = false;
		}
	});
	return result;
}

function chkCacheFile(filename) {
	try {
		return fs.lstatSync(filename).isFile();
	} catch(err) {
		// console.log('chk ' + filename + ' not found');
	}
	return false;
}

function safeFilename(name) {
	return name.replace(/[ ?#/:\(\)<>|\\]/g, "_").trim();
}
