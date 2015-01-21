'use strict';

var express = require('express');
var crypto = require('crypto');

var app = (module.exports = express.Router());

app.use('/status/204', function (req, res, next) {
  res.statusCode = 204;
  res.end();
});
[301, 302, 303, 307, 308].forEach(function (status) {
  app.use('/status/' + status, function (req, res, next) {
    res.redirect(status, '../check');
  });
});
app.use('/check', function (req, res, next) {
  var shasum = crypto.createHash('sha1');
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    req.pipe(shasum).on('erorr', next).on('end', function () {
      var body = shasum.digest();
      res.json({
        httpVersion: req.httpVersion,
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: body
      });
    });
  } else {
    res.json({
      httpVersion: req.httpVersion,
      url: req.url,
      method: req.method,
      headers: req.headers
    });
  }
});
