/**
 * opacity on mousemove for result-compare
 */
'use strict';

/* globals document */

var resultCompare = function() {
	var image = document.getElementById('result-compare2-img');
	var sensor = document.getElementById('result-compare-sensor');
	var width = sensor.getBoundingClientRect().width;
	var left = sensor.getBoundingClientRect().left;
	sensor.addEventListener('mousemove', mousemoveHandler);

	function mousemoveHandler(e) {
		var value = (e.clientX - left) / width;
		image.style.opacity = value;
		sensor.style.backgroundPosition = ((width * value) - 3) + 'px 0px';
	}
};
resultCompare();
