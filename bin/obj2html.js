/*
 * Erzeugen von HTML aus Objekt
 * Array als <ol>, Hash als <dl>
 *
 * (c) Uwe Gerdes, entwicklung@uwegerdes.de
 */
'use strict';

const ind = '\t';

module.exports = {
	toHtml: (obj) => {
		return toHTML(obj, ind);
	}
};

function toHTML(obj, indent) {
	let html = '';
	if (type(obj) == 'Array') {
		html += indent + '<ol>\n';
		obj.forEach((obj) => {
			html += indent + ind + '<li>\n';
			html += toHTML(obj, indent + ind + ind);
			html += indent + ind + '</li>\n';
		});
		html += indent + '</ol>\n';
	} else if (type(obj) == 'Object') {
		html += indent + '<dl>\n';
		Object.keys(obj).forEach((key) => {
			html += indent + ind + '<dt class="' + key + '">' + key + '</dt>\n' + indent + ind +'<dd class="' + key + ' ' + type(obj[key]) + '">';
			if (type(obj) == 'Array') {
				html += '\n' + toHTML(obj[key], indent + ind + ind) + indent + ind;
			} else if (type(obj) == 'Object') {
				html += '\n' + toHTML(obj[key], indent + ind + ind) + indent + ind;
			} else {
				html += obj[key] + '';
			}
			html += '</dd>\n';
		});
		html += indent + '</dl>\n';
	} else {
		html += indent + '<span class="' + type(obj) + '">' + obj.toString().replace(/</g, '&lt;') + '</span>\n';
	}
	return html;
}

function type(obj) {
	return Object.prototype.toString.call(obj).replace(/\[object (.+)\]/, '$1');
}
