/**!
 * cnpmjs.org - test/controllers/registry/package/list.test.js
 *
 * Copyright(c) cnpmjs.org and other contributors.
 * MIT Licensed
 *
 * Authors:
 *  fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var should = require('should');
var request = require('supertest');
var mm = require('mm');
var packageService = require('../../../../services/package');
var app = require('../../../../servers/registry');
var utils = require('../../../utils');
var SyncModuleWorker = require('../../../../controllers/sync_module_worker');
var config = require('../../../../config');

describe('controllers/registry/package/list.test.js', function () {
  afterEach(mm.restore);

  before(function (done) {
    var pkg = utils.getPackage('testmodule-list-1', '0.0.1', utils.admin);
    pkg.versions['0.0.1'].dependencies = {
      bytetest: '~0.0.1',
      mocha: '~1.0.0'
    };
    request(app.listen())
    .put('/' + pkg.name)
    .set('authorization', utils.adminAuth)
    .send(pkg)
    .expect(201, function (err) {
      should.not.exist(err);
      var pkg = utils.getPackage('testmodule-list-1', '1.0.0', utils.admin);
      pkg.versions['1.0.0'].dependencies = {
        bytetest: '~0.0.1',
        mocha: '~1.0.0'
      };
      request(app.listen())
      .put('/' + pkg.name)
      .set('authorization', utils.adminAuth)
      .send(pkg)
      .expect(201, done);
    });
  });

  it('should return all versions', function (done) {
    request(app.listen())
    .get('/testmodule-list-1')
    .expect(200, function (err, res) {
      should.not.exist(err);
      var data = res.body;
      data.name.should.equal('testmodule-list-1');
      Object.keys(data.versions).should.eql(['1.0.0', '0.0.1']);

      // should 304
      request(app)
      .get('/testmodule-list-1')
      .set('If-None-Match', res.headers.etag)
      .expect(304, done);
    });
  });

  it('should show star users', function (done) {
    mm(packageService, 'listStarUserNames', function* () {
      return ['fengmk2', 'foouser'];
    });
    request(app.listen())
    .get('/testmodule-list-1')
    .expect(200, function (err, res) {
      should.not.exist(err);
      var data = res.body;
      data.name.should.equal('testmodule-list-1');
      data.users.should.eql({
        fengmk2: true,
        foouser: true
      });
      done();
    });
  });

  it('should 404 when package not exists', function (done) {
    request(app.listen())
    .get('/not-exists-package')
    .expect(404)
    .expect({
      error: 'not_found',
      reason: 'document not found'
    }, done);
  });

  it('should not sync not-exists package when config.syncByInstall = false', function (done) {
    mm(config, 'syncByInstall', false);
    request(app.listen())
    .get('/not-exists-package')
    .expect(404)
    .expect({
      error: 'not_found',
      reason: 'document not found'
    }, done);
  });

  it('should sync not-exists package when config.syncByInstall = true', function (done) {
    mm(config, 'syncByInstall', true);
    request(app.listen())
    .get('/pedding')
    .expect(200, done);
  });

  it('should not sync not-exists scoped package', function (done) {
    mm(config, 'syncByInstall', true);
    request(app.listen())
    .get('/@cnpmtest/pedding')
    .expect(404)
    .expect({
      error: 'not_found',
      reason: 'document not found'
    }, done);
  });

  describe('unpublished', function () {
    before(function (done) {
      var worker = new SyncModuleWorker({
        name: 'tfs',
        noDep: true,
      });
      worker.start();
      worker.on('end', done);
    });

    it('should show unpublished info', function (done) {
      request(app.listen())
      .get('/tfs')
      .expect(404, function (err, res) {
        should.not.exist(err);
        var data = res.body;
        data.time.unpublished.name.should.equal('fengmk2');
        data.time.unpublished.description.should.equal('tfs');
        done();
      });
    });
  });

  describe('npm package', function () {
    before(function (done) {
      var worker = new SyncModuleWorker({
        name: 'tair',
        noDep: true,
      });
      worker.start();
      worker.on('end', done);
    });

    it('should show npm package after sync', function (done) {
      request(app.listen())
      .get('/tair')
      .expect(200, function (err, res) {
        should.not.exist(err);
        var data = res.body;
        data.name.should.equal('tair');
        data.maintainers.should.eql([
          {
            email: 'kate.sf@taobao.com',
            name: 'sunfang1cn'
          }
        ]);
        done();
      });
    });
  });

  describe('add tag', function () {
    var tagModified;
    before(function (done) {
      request(app.listen())
      .put('/testmodule-list-1/test-tag')
      .set('content-type', 'application/json')
      .set('authorization', utils.adminAuth)
      .send(JSON.stringify('0.0.1'))
      .expect(201, function (err, res) {
        should.not.exist(err);
        res.body.ok.should.equal(true);
        tagModified = res.body.modified;
        done();
      });
    });

    it('should use tag gmt_modified', function (done) {
      request(app.listen())
      .get('/testmodule-list-1')
      .expect(200, function (err, res) {
        should.not.exist(err);
        var data = res.body;
        data.name.should.equal('testmodule-list-1');
        data.time.modified.should.equal(tagModified);
        done();
      });
    });
  });
});