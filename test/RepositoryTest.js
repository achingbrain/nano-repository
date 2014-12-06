var Repository = require('../lib/Repository'),
  sinon = require('sinon'),
  chai = require('chai').should,
  expect = require('chai').expect,
  util = require('util'),
  fs = require('fs');

var TestRepository = function(db) {
  Repository.call(this, db);
};
util.inherits(TestRepository, Repository);

// stub nano object
var db;

describe('Repository', function() {
  beforeEach(function() {
    db = {
      get: sinon.stub(),
      config: {
        db: 'test_database'
      },
      insert: sinon.stub(),
      view: sinon.stub(),
      destroy: sinon.stub(),
      attachment: {
        insert: sinon.stub(),
        get: sinon.stub()
      }
    }
  });

  it('should object when no database passed', function() {
    expect(function() {
      new TestRepository();
    }).to.throw(Error);
  });

  it('should generate methods from views', function (done) {
    db.get.withArgs('_design/test_database', sinon.match.func).callsArgWith(1, undefined, {});
    db.insert.withArgs(sinon.match.object, '_design/test_database', sinon.match.func).callsArgWith(2, undefined);

    var repository = new TestRepository(db);

    // these methods will be defined by the view definition
    expect(repository.findAll).to.not.be.a('function');
    expect(repository.findByName).not.to.be.a('function');

    // update the views
    repository.updateViews(__dirname + '/fixtures/ViewDefinitions.json', function(error) {
      if(error) {
        fail(error);
      }

      // these methods are defined by the view definitions
      expect(repository.findAll).to.be.a('function');
      expect(repository.findByName).to.be.a('function');

      done();
    });
  });
  
  it('should callback with error when view file does not exist', function (done) {
    var repository = new TestRepository(db);
    
    // update the views
    repository.updateViews(__dirname + '/fixtures/nope.json', function(error) {
      expect(error).to.be.ok
      
      done()
    });
  });

  it('should call view methods', function (done) {
    db.get.withArgs('_design/test_database', sinon.match.func).callsArgWith(1, undefined, {
      hash: "47c7aeb99d395048244a1723f363d4c5"
    });
    db.view.withArgs('test_database', 'all', sinon.match.func).callsArgWith(2, undefined, {
      rows: [{}, {}, {}]
    });

    var repository = new TestRepository(db);

    // update the views
    repository.updateViews(__dirname + '/fixtures/ViewDefinitions.json', function(error) {
      if(error) {
        fail(error);
      }

      repository.findAll(function(error, result) {
        expect(result.length).to.equal(3);

        done();
      });
    });
  });

  it('should call view methods with parameters', function (done) {
    db.get.withArgs('_design/test_database', sinon.match.func).callsArgWith(1, undefined, {
      hash: "47c7aeb99d395048244a1723f363d4c5"
    });
    db.view.withArgs('test_database', 'byName', {keys: ['foo']}, sinon.match.func).callsArgWith(3, undefined, {
      rows: [{}, {}, {}, {}]
    });

    var repository = new TestRepository(db);

    // update the views
    repository.updateViews(__dirname + '/fixtures/ViewDefinitions.json', function(error) {
      if(error) {
        fail(error);
      }

      repository.findByName('foo', function(error, result) {
        expect(result.length).to.equal(4);

        done();
      });
    });
  });

  it('should not overwrite views when they have not changed', function (done) {
    db.get.withArgs('_design/test_database', sinon.match.func).callsArgWith(1, undefined, {
      hash: "47c7aeb99d395048244a1723f363d4c5"
    });

    var repository = new TestRepository(db);

    // these methods will be defined by the view definition
    expect(repository.findAll).to.not.be.a('function');
    expect(repository.findByName).not.to.be.a('function');

    // update the views
    repository.updateViews(__dirname + '/fixtures/ViewDefinitions.json', function(error) {
      if(error) {
        fail(error);
      }

      sinon.assert.notCalled(db.insert);

      done();
    });
  });

  it('should overwrite views when they have not changed', function (done) {
    db.get.withArgs('_design/test_database', sinon.match.func).callsArgWith(1, undefined, {
      hash: "lalalala"
    });
    db.insert.withArgs(sinon.match.object, '_design/test_database', sinon.match.func).callsArgWith(2, undefined);

    var repository = new TestRepository(db);

    // these methods will be defined by the view definition
    expect(repository.findAll).to.not.be.a('function');
    expect(repository.findByName).not.to.be.a('function');

    // update the views
    repository.updateViews(__dirname + '/fixtures/ViewDefinitions.json', function(error) {
      if(error) {
        fail(error);
      }

      db.insert.withArgs('_design/test_database', sinon.match.func);

      done();
    });
  });

  it('should find by id', function (done) {
    var id = 'foo';
    var document = {
      bar: 'baz'
    };

    db.get.withArgs(id, sinon.match.func).callsArgWith(1, undefined, document);

    var repository = new TestRepository(db);
    repository.findById(id, function(error, result) {
      expect(result).to.equal(document);

      done();
    });
  });

  it('should save', function (done) {
    var id = 'foo';
    var rev = 1;
    var document = {
      bar: 'baz'
    };

    db.insert.withArgs(document, sinon.match.func).callsArgWith(1, undefined, {
      id: id,
      rev: rev
    });

    var repository = new TestRepository(db);
    repository.save(document, function(error, result) {
      expect(document._id).to.equal(id);
      expect(document._rev).to.equal(rev);
      expect(document.created_at).to.be.ok;

      done();
    });
  });

  it('should update', function (done) {
    var id = 'foo';
    var rev = 2;
    var document = {
      bar: 'baz',
      created_at: new Date()
    };

    db.insert.withArgs(document, sinon.match.func).callsArgWith(1, undefined, {
      id: id,
      rev: rev
    });

    var repository = new TestRepository(db);
    repository.save(document, function(error, result) {
      expect(document._id).to.equal(id);
      expect(document._rev).to.equal(rev);
      expect(document.updated_at).to.be.ok;

      done();
    });
  });

  it('should remove', function (done) {
    var id = 'foo';
    var document = {
      bar: 'baz',
      created_at: new Date(),
      _rev: 2,
      _id: id
    };

    db.destroy.withArgs(id, document._rev, sinon.match.func).callsArg(2);

    var repository = new TestRepository(db);
    repository.remove(document, function() {
      done();
    });
  });

  it('should add an attachment', function (done) {
    var document = {
      bar: 'baz',
      created_at: new Date(),
      _id: 'foo',
      _rev: 2
    };
    var name = 'my file';
    var mimeType = 'text/plain';
    var file = __dirname + '/fixtures/file.txt';
    var body = {
      rev: 3
    };

    db.attachment.insert.withArgs(document._id, name, sinon.match.object, mimeType, sinon.match.object, sinon.match.func).callsArgWith(5, undefined, body);

    var repository = new TestRepository(db);
    repository.addAttachment(document, name, file, mimeType, function(error, body) {
      expect(document._rev).to.equal(body.rev);

      done();
    });
  });

  it('should receive a streamed attachment', function (done) {
    var document = {
      bar: 'baz',
      created_at: new Date(),
      _id: 'foo',
      _rev: 2
    };
    var name = 'my file';
    var mimeType = 'text/plain';
    var fileStream = fs.createReadStream(__dirname + '/fixtures/file.txt');
    var body = {
      rev: 3
    };

    db.attachment.insert.withArgs(document._id, name, null, mimeType, sinon.match.object, sinon.match.func).returns({
      on: sinon.stub(),
      once: sinon.stub(),
      emit: sinon.stub(),
      write: sinon.stub(),
      end: sinon.stub()
    }).callsArgWith(5, undefined, body);

    var repository = new TestRepository(db);

    fileStream.pipe(repository.addAttachment(document, name, mimeType, function(error, body) {
      expect(document._rev).to.equal(body.rev);

      done();
    }));
  });

  it('should retrieve an attachment', function (done) {
    var document = {
      bar: 'baz',
      created_at: new Date(),
      _id: 'foo',
      _rev: 2
    };
    var name = 'my file';
    var bytes = [0x00, 0x00, 0x00];

    db.attachment.get.withArgs(document._id, name, sinon.match.func).callsArgWith(2, undefined, bytes);

    var repository = new TestRepository(db);
    repository.findAttachment(document, name, function(error, body) {
      expect(body).to.equal(bytes);

      done();
    });
  });

  it('should stream an attachment', function() {
    var document = {
      bar: 'baz',
      created_at: new Date(),
      _id: 'foo',
      _rev: 2
    };
    var name = 'my file';
    var pipe = {
      pipe: sinon.stub()
    };
    var output = {};

    db.attachment.get.withArgs(document._id, name).returns(pipe);

    var repository = new TestRepository(db);
    repository.streamAttachmentTo(document, name, output);

    // should have streamed to the passed output
    pipe.pipe.calledWith(output);
  });
});
