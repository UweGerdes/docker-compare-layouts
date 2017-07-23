//
// default configuration for compare-layouts
//

var slimerjs = 'slimerjs';
var phantomjs = 'phantomjs';

slimerjs = phantomjs;

// TODO implement
var viewports = [
	{
		'name': 'smartphone-portrait',
		'viewport': {width: 320, height: 480}
	},
	{
		'name': 'desktop-standard',
		'viewport': {width: 1280, height: 1024}
	}
];

module.exports = {
	destDir: 'default',
	whitelist: 'www.uwegerdes.de', // allow load from uri with this substring
	blacklist: '.js', // do not load - even if it comes from whitelist
	widths: [ 1200, 1024, 768, 600, 360, 320 ],
	pages: {
		'index-phantomjs': {
			'url': 'http://localhost:3000/',
			'selector': 'body',
			'engine': phantomjs,
			'cache': false
		},
		'index-slimerjs': {
			'url': 'http://localhost:3000/',
			'selector': 'body',
			'engine': slimerjs,
			'cache': false
		},
		'app-phantomjs': {
			'url': 'http://localhost:3000/app',
			'selector': 'body',
			'engine': phantomjs,
			'cache': false
		},
		'app-slimerjs': {
			'url': 'http://localhost:3000/app',
			'selector': 'body',
			'engine': slimerjs,
			'cache': false
		}
	},
	compares: {
		'index-phantomjs-slimerjs': {
			compare: ['tagName', 'type', 'textContent', 'name', 'value'],
			page1: 'index-phantomjs',
			page2: 'index-slimerjs',
			showHTML: true
		},
		'app-phantomjs-slimerjs': {
			compare: ['tagName', 'type', 'textContent', 'name', 'value'],
			page1: 'app-phantomjs',
			page2: 'app-slimerjs',
			showHTML: true
		}
	}
};
