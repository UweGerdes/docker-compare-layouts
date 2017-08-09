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
var results = {};

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
		if (reload || !page.cache || !fs.existsSync(path.join(destDir,  pageKey))) {
			console.log('loading: ' + pageKey);
			loadPage(configFile, pageKey, page);
		} else {
			console.log('cached : ' + pageKey);
			pagesLoaded++;
		}
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
			if (process.platform == "linux") {
//				cmd = 'xvfb-run -a -e /dev/stdout casperjs';
				cmd = 'xvfb-run -a casperjs';
			}
		}
	}
	var loader = exec(cmd + ' ' + args.join(' '),
		function (error, stdout, stderr) {
			logExecResult('loaded page ' + page.url, error, "", stderr);
		}
	);
	loader.stdout.on('data', function(data) { if (verbose || data.indexOf('element not found') > -1) {console.log(pageKey + ': ' + data.trim());} });
	loader.stderr.on('data', function(data) { console.log(pageKey + ' stderr: ' + data.trim()); });
	loader.on('error', function(err) { console.log(pageKey + ' error: ' + err); });
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
	Object.keys(compares).forEach(function(key) {
		console.log('compare ' + key);
		if (!fs.existsSync(path.join(destDir,  safeFilename(key)))) {
			fs.mkdirSync(path.join(destDir,  safeFilename(key)));
		}
		var compare = compares[key];
		var page1 = pages[compare.page1];
		var page2 = pages[compare.page2];
		if (page1 === null || page1 === undefined) {
			console.log('ERROR in configfile: compage selector page1 "' + compare.page1 + '" not found');
			return;
		}
		if (page2 === null || page2 === undefined) {
			console.log('ERROR in configfile: compage selector page2 "' + compare.page2 + '" not found');
			return;
		}
		Object.keys(config.viewports).forEach(function(viewport) {
			var result = {};
			result.name = key;
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
			result.success = false;
			if ((page1.cache || page1.loaded) && result.exists1 &&
				(page2.cache || page2.loaded) && result.exists2) {
				var resultPath = path.join(destDir,  safeFilename(key),  viewport);
				pagesLoading.push(key);
				result.success = true;
				result.compareFilename = resultPath + '_compare.png';
				result.compositeFilename = resultPath + '_composite.png';
				result.jsonFilename = resultPath + '.json';
				result.htmlFilename = resultPath + '.html';
				exec('compare -metric AE "' + result.baseFilename1 + '.png" "' + result.baseFilename2 + '.png" ' + result.compareFilename,
					function (error, stdout, stderr) {
						if (verbose) { logExecResult('compare', null, stdout, stderr.replace(/ @.+/, '').replace(/^0$/, '')); }
						if (stderr == '0') {
							if (verbose) { console.log(result.compareFilename + ' saved'); }
						} else {
							result.success = false;
							success = false;
						}
						result.imageStderr = stderr;
						exec('composite -compose difference "' + result.baseFilename1 + '.png" "' + result.baseFilename2 + '.png" ' + result.compositeFilename,
							function (error, stdout, stderr) {
								logExecResult('composite', null, stdout, stderr.replace(/ @.+/, ''));
								if (stderr.length === 0) {
									if (verbose) { console.log(result.compositeFilename + ' saved'); }
								} else {
									result.compositeFilename = '';
									result.success = false;
									success = false;
								}
								compareResults(compare, key, viewport);
							}
						);
					}
				);
			} else {
				console.log('loaded pages not found');
			}
			results[ key + '_' + viewport ] = result;
		});
	});
}

function compareResults(compare, name, viewport) {
	var page1 = pages[compare.page1];
	var selector1 = compare.selector1 ? compare.selector1 : page1.selector;
	var page2 = pages[compare.page2];
	var selector2 = compare.selector2 ? compare.selector2 : page2.selector;
	var result = true;
	if (chkCacheFile(path.join(destDir,  compare.page1,  viewport,  safeFilename(selector1) + '.json')) &&
		chkCacheFile(path.join(destDir,  compare.page2,  viewport,  safeFilename(selector2) + '.json'))) {
		var styleTree1 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,  compare.page1,  viewport,  safeFilename(selector1) + '.json'))));
		var styleTree2 = styleTree(JSON.parse(fs.readFileSync(path.join(destDir,  compare.page2,  viewport,  safeFilename(selector2) + '.json'))));
		var compareResult = styleTree1.compareTo(styleTree2, compare.compare);
		var jsonFilename = path.join(destDir,  safeFilename(name),  viewport + '.json');
		fs.writeFile(jsonFilename, JSON.stringify(compareResult, undefined, 4), function(err) {
			if(err) {
				return console.log(jsonFilename + ' error: ' + err);
			}
			console.log(jsonFilename + ' saved');
			pagesLoading.splice(pagesLoading.indexOf(compare), 1);
			if (pagesLoading.length === 0) {
				saveResults(compare, results, success);
			}
		});
	} else {
		result = false;
	}
	return result;
}

function saveResults(compare, results, success) {
	fs.writeFile(path.join(destDir,  'index.json'), JSON.stringify(results, null, 4), function(err) {
		if(err) {
			return console.log(path.join(destDir,  'index.json') + ' error: ' + err);
		}
		console.log((success ? "SUCCESS" : "FAIL") + ' - result in: ' + path.join(destDir,  'index.json'));
	});
}

function logExecResult(msgStart, error, stdout, stderr) {
	if (stdout.length > 0) { console.log(msgStart + ' stdout: ' + stdout.trim()); }
	if (stderr.length > 0) { console.log(msgStart + ' stderr: ' + stderr.trim()); }
	if (error !== null)	{ console.log(msgStart + ' error:\n' + JSON.stringify(error, undefined, 4)); }
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
	return name.replace(/[ .?#/:\(\)<>|\\]/g, "_").trim();
}
