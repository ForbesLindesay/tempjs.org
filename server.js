'use strict';

var fs = require('fs');
var express = require('express');
var browserify = require('browserify-middleware');
var body = require('body-parser');
var LRU = require('lru-cache');
var shasum = require('shasum');
var mongod = require('mongod');
var Promise = require('promise');

var db = mongod(process.env.MONGO_DB, ['files']);
var cache = new LRU({
  max: 1024*1024*10,
  length: function (n) { return n.body.length + n.libraries.length * 100 }
});

var create = fs.readFileSync(__dirname + '/lib/create.html', 'utf8');
var app = express();

app.get('/files/:id/index.html', function (req, res, next) {
  var id = req.params.id;
  var doc = cache.get(id);
  if (doc === undefined) {
    db.files.findOne({_id: id}).done(function (doc) {
      if (!doc) return next();
      cache.set(id, doc);
      send(res, doc);
    }, next);
  } else {
    send(res, doc);
  }
});
function send(res, doc) {
  var libs = doc.libraries.map(function (lib) {
    return '<script src="' + lib + '"></script>';
  }).join('');
  // max age = 1 year
  res.setHeader('cache-control', 'public,max-age=31536000');
  res.send('<!DOCTYPE html><html><head></head><body>' + libs + '<script src="/files/' + doc._id + '/index.js"></script></body></html>');
}
app.get('/files/:id/index.js', function (req, res, next) {
  var id = req.params.id;
  var doc = cache.get(id);
  if (doc === undefined) {
    db.files.findOne({_id: id}).done(function (doc) {
      if (!doc) return next();
      cache.set(id, doc);
      // max age = 1 year
      res.setHeader('cache-control', 'public,max-age=31536000');
      res.type('js');
      res.send(doc.body);
      db.files.update({_id: id}, {
        '$inc': { 'count': 1 },
        '$set': { 'accessed': Date.now() }
      }).done(null, function (err) {
        console.error(err.stack || err.message);
      });
    }, next);
  } else {
    db.files.update({_id: id}, {
      '$inc': { 'count': 1 },
      '$set': { 'accessed': Date.now() }
    }).done(null, function (err) {
      console.error(err.stack || err.message);
    });
    // max age = 1 year
    res.setHeader('cache-control', 'public,max-age=31536000');
    res.type('js');
    res.send(doc.body);
  }
});
app.get('/', function (req, res, next) {
  res.send(create);
});
app.post('/create',
         body.text({inflate: true, limit: '1mb'}),
         body.json({inflate: true, limit: '1mb'}),
         function (req, res, next) {
  if (!req.body) next(new Error('body cannot be null or undefined'));
  var doc;
  if (typeof req.body === 'string') {
    doc = {body: req.body, libraries: []};
  } else {
    doc = {body: req.body.body, libraries: req.body.libraries || []};
  }
  if (typeof doc.body !== 'string') {
    return next(new Error('body must be a string'));
  }
  if (!Array.isArray(doc.libraries)) {
    return next(new Error('libraries must be an array'));
  }
  if (!doc.libraries.every(function (lib) { return typeof lib === 'string'; })) {
    return next(new Error('libraries must be strings'));
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
