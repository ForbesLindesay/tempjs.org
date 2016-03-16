'use strict';

var request = require('then-request');

var fm = document.getElementById('fm');
var js = document.getElementById('js');
fm.addEventListener('submit', function (e) {
  e.preventDefault();
  var libs = [];
  var checkboxes = document.querySelectorAll('input[type="checkbox"][data-href]');
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) {
      libs.push(checkboxes[i].getAttribute('data-href'));
    }
  }

  request('POST', '/create', {
    json: {
      script: js.value,
      libraries: libs
    }
  }).getBody('utf8').then(JSON.parse).done(function (res) {
    location.assign(res.path);
  }, function (err) {
    alert('something went wrong');
    throw err;
  });
}, false);

var libraries = document.getElementById('libraries');
var add = document.getElementById('add-library');
var lib = document.getElementById('new-library');

add.addEventListener('click', function (e) {
  e.preventDefault();
  if (lib.value.trim()) {
    addLibrary(lib.value.trim(), true);
    lib.value = '';
  }
}, false);

function addLibrary(url, checked) {
  var wrap = document.createElement('div');
  wrap.setAttribute('class', 'checkbox');
  var label = document.createElement('label');
  wrap.appendChild(label);
  var input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('data-href', url);
  input.checked = checked;
  label.appendChild(input);
  var text = document.createTextNode(' ' + url);
  label.appendChild(text);
  libraries.appendChild(wrap);
}

addLibrary('https://code.jquery.com/jquery-2.1.3.min.js', false);
addLibrary('https://code.jquery.com/jquery-1.11.2.min.js', false);
