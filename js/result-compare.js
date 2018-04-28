/**
 * opacity on mousemove for result-compare, slider positioning
 */
'use strict';

/* jshint esversion: 5, varstmt: false, browser: true */

/**
 * add mouse move handler for result image compare
 */
var resultCompare = function () {
  var container = document.getElementById('result-compare2');
  var sensor = document.getElementById('result-compare-sensor');
  var width = sensor.getBoundingClientRect().width;
  var left = sensor.getBoundingClientRect().left;
  sensor.addEventListener('mousemove', mousemoveHandler);

  function mousemoveHandler(e) { // jscs:ignore jsDoc
    var value = (e.clientX - left) / width;
    container.style.opacity = value;
    sensor.style.backgroundPosition = ((width * value) - 3) + 'px 0px';
  }
};
resultCompare();
