'use strict';

process.env.NODE_ENV = 'production';
var assert = require('assert');
var request = require('then-request');

var server = null;

if (process.argv[2] === 'local') {
  server = require('./server');
}

var base = null;
switch (process.argv[2]) {
  case 'local':
    base = 'http://localhost:3000';
    break;
  case 'staging':
    base = 'https://tempjs-staging.herokuapp.com';
    break;
  case 'prod':
    base = 'https://tempjs.org/';
    break;
  default:
    console.error('Unrecognised environment ' + process.argv[2]);
}

request('POST', base + '/create', {
  json: {
    script: "var p = document.createElement('p');\n" +
            "p.textContent = 'Hello World';\n" +
            "document.body.appendChild(p);"
  }
}).getBody('utf8').then(JSON.parse).then(function (res) {
  assert(res.id === '3c9f057200c5d5d245c1183cb5e382d07b476978');
  assert(res.path === '/files/3c9f057200c5d5d245c1183cb5e382d07b476978/index.html');
  console.log('https://tempjs.org' + res.path);

  return request('POST', base + '/create', {
    json: {
      html: '{{styles}}<h1>My Page</h1>{{scripts}}',
      stylesheets: [ 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.1/css/bootstrap.min.css' ],
      style: 'h1 { color: red; }',
      script: "$('body').append('<p>Hello World</p>');",
      libraries: [ 'https://code.jquery.com/jquery-2.1.3.min.js' ]
    }
  }).getBody('utf8').then(JSON.parse);
}).done(function (res) {
  assert(res.id === 'b004d8e0501b58b511574b20312656259de9776a');
  assert(res.path === '/files/b004d8e0501b58b511574b20312656259de9776a/index.html');
  console.log('https://tempjs.org' + res.path);
  if (server) server.close();
});
