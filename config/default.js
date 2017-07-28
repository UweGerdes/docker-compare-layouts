/**
 * default configuration for compare-layouts
 */

var slimerjs = 'slimerjs';
var phantomjs = 'phantomjs';

module.exports = {
	destDir: 'default',
	whitelist: 'fonts.googleapis.com, fonts.gstatic.com', // allow load from uri with this substring
	blacklist: '.js', // do not load - even if it comes from whitelist
	widths: [ 768, 1200 ],
	viewports: {
		'iPhone-5':        { width:  320, height:  568 },
		'iPhone-6':        { width:  375, height:  667 },
		'Galaxy-S5':       { width:  360, height:  640 },
		'Tablet-Portrait': { width:  768, height: 1024 },
		'Desktop':         { width: 1280, height: 1024 }
	},
	pages: {
		'index-phantomjs': {
			'url': 'http://localhost:3000/',
			'selector': 'body',
			'engine': phantomjs,
			'cache': false
		},
		'index-phantomjs-cached': {
			'url': 'http://localhost:3000/',
			'selector': 'body',
			'engine': phantomjs,
			'cache': true
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
		},
		'app-slimerjs-cached': {
			'url': 'http://localhost:3000/app',
			'selector': 'body',
			'engine': slimerjs,
			'cache': true
		}
	},
	compares: {
		'index-phantomjs-slimerjs': {
			compare: ['tagName', 'type', 'textContent', 'name', 'value'],
			page1: 'index-phantomjs',
			page2: 'index-slimerjs',
			showHTML: false
		},
		'index-phantomjs-cached-phantomjs': {
			compare: ['tagName', 'type', 'textContent', 'name', 'value'],
			page1: 'index-phantomjs-cached',
			page2: 'index-phantomjs',
			showHTML: false
		},
		'app-phantomjs-slimerjs': {
			compare: ['tagName', 'type', 'textContent', 'name', 'value'],
			page1: 'app-phantomjs',
			page2: 'app-slimerjs',
			showHTML: false
		},
		'app-slimerjs-cached-slimerjs': {
			compare: ['tagName', 'type', 'textContent', 'name', 'value'],
			page1: 'app-slimerjs-cached',
			page2: 'app-slimerjs',
			showHTML: false
		}
	}
};
