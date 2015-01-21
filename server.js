'use strict';

var fs = require('fs');
var express = require('express');
var browserify = require('browserify-middleware');
var body = require('body-parser');
var LRU = require('lru-cache');
var shasum = require('shasum');
var mongod = require('mongod');
var Promise = require('promise');
var ajax = require('./lib/ajax');

var db = mongod(process.env.MONGO_DB, ['files']);
var cache = new LRU({
  max: 1024*1024*10,
  length: function (n) {
    return JSON.stringify(n).length;
  }
});

var create = fs.readFileSync(__dirname + '/lib/create.html', 'utf8');
var app = express();

app.use('/ajax', ajax);

function readDoc(id) {
  var doc = cache.get(id);
  if (doc === undefined) {
    return db.files.findOne({_id: id}).done(function (doc) {
      if (!doc) return;
      cache.set(id, doc);
      db.files.update({_id: id}, {
        '$inc': { 'count': 1 },
        '$set': { 'accessed': Date.now() }
      }).done(null, function (err) {
        console.error(err.stack || err.message);
      });
      return doc;
    });
  } else {
    db.files.update({_id: id}, {
      '$inc': { 'count': 1 },
      '$set': { 'accessed': Date.now() }
    }).done(null, function (err) {
      console.error(err.stack || err.message);
    });
    return Promise.resolve(doc);
  }
}

app.get('/files/:id/index.html', function (req, res, next) {
  var id = req.params.id;
  readDoc(id).done(function (doc) {
    if (!doc) return next();
    var styles = doc.stylesheets.map(function (stylesheet) {
      return '<link rel="stylesheet" href="' + stylesheet + '"></script>';
    }).join('');
    var scripts = doc.libraries.map(function (lib) {
      return '<script src="' + lib + '"></script>';
    }).join('');
    // max age = 1 year
    res.setHeader('cache-control', 'public,max-age=31536000');
    if (doc.style) {
      styles += '<link rel="stylesheet" href="' + doc._id + '"></script>';
    }
    if (doc.script || doc.body) {
      scripts += '<script src="/files/' + doc._id + '/index.js"></script>';
    }
    var html = doc.html ||
       '<!DOCTYPE html><html><head>{{styles}}</head><body>{{scripts}}</body></html>';
    html = html.replace(/\{\{styles\}\}/g, styles);
    html = html.replace(/\{\{scripts\}\}/g, scripts);
    res.send(html);
  }, next);
});
app.get('/files/:id/index.js', function (req, res, next) {
  var id = req.params.id;
  readDoc(id).done(function (doc) {
    // max age = 1 year
    res.setHeader('cache-control', 'public,max-age=31536000');
    res.type('js');
    res.send(doc.script || doc.body);
  }, next);
});
app.get('/files/:id/index.css', function (req, res, next) {
  var id = req.params.id;
  readDoc(id).done(function (doc) {
    // max age = 1 year
    res.setHeader('cache-control', 'public,max-age=31536000');
    res.type('css');
    res.send(doc.style);
  }, next);
});
app.get('/', function (req, res, next) {
  res.send(create);
});
function isString(v) { return typeof v === 'string'; }
app.post('/create',
         body.json({inflate: true, limit: '1mb'}),
         function (req, res, next) {
  if (!req.body) next(new Error('body cannot be null or undefined'));
  var doc = {
    html: req.body.html || '',
    script: req.body.script || req.body.body || '',
    libraries: req.body.libraries || [],
    style: req.body.style || '',
    stylesheets: req.body.stylesheets || []
  };
  if (typeof doc.html !== 'string') {
    return next(new Error('html must be a string'));
  }
  if (typeof doc.script !== 'string') {
    return next(new Error('script must be a string'));
  }
  if (!Array.isArray(doc.libraries)) {
    return next(new Error('libraries must be an array'));
  }
  if (!doc.libraries.every(isString)) {
    return next(new Error('libraries must be strings'));
  }
  if (typeof doc.style !== 'string') {
    return next(new Error('style must be a string'));
  }
  if (!Array.isArray(doc.stylesheets)) {
    return next(new Error('stylesheets must be an array'));
  }
  if (!doc.stylesheets.every(isString)) {
    return next(new Error('stylesheets must be strings'));
  }
  var id = shasum(doc);
  doc._id = id;
  var now = Date.now();
  doc.created = now;
  doc.accessed = now;
  doc.count = 0;
  db.files.update({_id: id}, doc, {upsert: true}).done(function () {
    cache.set(id, doc);
    res.send({id: id, path: '/files/' + id + '/index.html'});
    cleanup();
  }, next);
});
app.get('/create.js', browserify(__dirname + '/lib/create.js'));

function cleanup() {
  // remove docs that aren't in the 100 most recently accessed
  db.files.find().sort({accessed: -1}).skip(100).then(function (docs) {
    return Promise.all(docs.map(function (doc) {
      cache.del(doc._id);
      return db.files.remove({_id: doc._id});
    }));
  }).done(null, function (err) {
    console.error(err.stack || err.message);
  });
  // remvoe docs that were created 24 hours
  db.files.find({
    accessed: {
      $lt: Date.now() - (24 * 60 * 60 * 1000)
    }
  }).then(function (docs) {
    return Promise.all(docs.map(function (doc) {
      cache.del(doc._id);
      return db.files.remove({_id: doc._id});
    }));
  }).done(null, function (err) {
    console.error(err.stack || err.message);
  });
}
cleanup();

app.listen(process.env.PORT || 3000);
