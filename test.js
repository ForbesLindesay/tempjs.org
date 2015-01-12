'use strict';

var assert = require('assert');
var request = require('then-request');

request('POST', 'http://localhost:3000/create', {
  json: {
    body: "var p = document.createElement('p');\n" +
          "p.textContent = 'Hello World';\n" +
          "document.body.appendChild(p);"
  }
}).getBody('utf8').then(JSON.parse).then(function (res) {
  console.dir(res);
  assert(res.id === '36e5035e7b364d50d547c22c5b2ba78c9736acfc');
  assert(res.path === '/files/36e5035e7b364d50d547c22c5b2ba78c9736acfc/index.html');
  console.log('https://tempjs.org' + res.path);

  return request('POST', 'http://localhost:3000/create', {
    json: {
      body: "$('body').append('<p>Hello World</p>');",
      libraries: [ 'https://code.jquery.com/jquery-2.1.3.min.js' ]
    }
  }).getBody('utf8').then(JSON.parse);
}).done(function (res) {
  console.dir(res);
  assert(res.id === '875d4cfcbfb3b563523cbd5c6b0ad86eb57d32e2');
  assert(res.path === '/files/875d4cfcbfb3b563523cbd5c6b0ad86eb57d32e2/index.html');
  console.log('https://tempjs.org' + res.path);
});
