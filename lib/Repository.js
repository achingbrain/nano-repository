var fs = require('fs'),
  crypto = require('crypto');

Repository = function(db, logger) {
  this._db = db;
  this._logger = logger || console;

  if (!this._db) {
    throw new Error('Please pass a collection into your repository.');
  }
};

Repository.prototype.updateViews = function(viewFile, callback) {
  callback = callback || function(){};

  // upgrade stored procedures if necessary
  fs.readFile(viewFile, "utf8", function(error, contents) {
    if(error) {
      return callback(error);
    }

    // calculate the md5 hash of the view definitions - if they haven't changed
    // then we don't need to update them..
    var md5sum = crypto.createHash("md5");
    md5sum.update(contents);

    var hash = md5sum.digest("hex");

    var data = JSON.parse(contents);
    data.hash = hash;

    // create view methods
    Object.keys(data.views).forEach(function(viewName) {
      var methodName = "find" + viewName.substr(0, 1).toUpperCase() + viewName.substr(1);

      this._logger.info("Repository", "Creating", methodName, "method for collection", this._db.config.db);

      this[methodName] = function() {
        var callback = arguments[arguments.length - 1];

        if(!callback || !(callback instanceof Function)) {
          throw new Error("Please specify a callback function to receive the result of " + methodName);
        }

        var args = [this._db.config.db, viewName];

        if(arguments.length > 1) {
          var parameters = {
            keys: []
          };

          for(var i = 0; i < arguments.length - 1; i++) {
            parameters.keys.push(arguments[i]);
          }

          args.push(parameters);
        }

        args.push(function(error, result) {
          if(error) {
            this._logger.error(error);

            result = {rows: []};
          }

          var output = [];

          result.rows.forEach(function(row) {
            output.push(row.value);
          })

          callback(error, output);
        }.bind(this));

        this._db.view.apply(this._db, args);
      }.bind(this);
    }.bind(this));

    // update views if necessary
    this._db.get("_design/" + this._db.config.db, function(error, result) {
      if(error && error.statusCode != 404) {
        return callback(error);
      }

      if(result) {
        if(result.hash == data.hash) {
          this._logger.info("Repository", "No view update required for collection", this._db.config.db);

          return callback();
        } else {
          this._logger.info("Repository", "View definitions have changed - will update collection", this._db.config.db);
        }

        data._rev = result._rev;
      }

      this._db.insert(data, "_design/" + this._db.config.db, callback);
    }.bind(this));
  }.bind(this));
};

Repository.prototype.findById = function(id, callback) {
  this._db.get(id, function(error, result) {
    callback(error, result);
  });
};

Repository.prototype.save = function(document, callback) {
  if(!document.created_at) {
    document.created_at = new Date();
  } else {
    document.updated_at = new Date();
  }

  this._db.insert(document, function(error, result) {
    if(!error) {
      document._id = result.id;
      document._rev = result.rev;
    }

    callback(error, result);
  });
};

Repository.prototype.remove = function(document, callback) {
  if(!document) {
    return callback(new Error('Document to remove was invalid!'));
  }

  if(!document._id) {
    return callback(new Error('Document to remove had no id!'));
  }

  if(!document._rev) {
    return callback(new Error('Document to remove had no revision!'));
  }

  this._db.destroy(document._id, document._rev, callback);
};

Repository.prototype.addAttachment = function(document, name, file, mimeType, callback) {
  if(arguments.length == 4) {
    return this._streamAttachment.apply(this, arguments);
  }

  fs.readFile(file, function(error, data) {
    if(error) {
      return callback(error);
    }

    this._db.attachment.insert(document._id, name, data, mimeType, {
      rev: document.rev ? document.rev : document._rev
    }, function(error, body) {
      if(!error) {
        document._rev = body.rev;
      }

      callback(error, body)
    });
  }.bind(this));
};

Repository.prototype._streamAttachment = function(document, name, mimeType, callback) {
  return this._db.attachment.insert(document._id, name, null, mimeType, {
      rev: document._rev
    },
    function(error, body) {
      if(!error) {
        document._rev = body.rev;
      }

      callback(error, body)
    }
  );
};

Repository.prototype.findAttachment = function(document, name, callback) {
  this._db.attachment.get(document._id, name, function(error, body) {
    callback(error, body);
  });
};

Repository.prototype.streamAttachmentTo = function(document, name, pipe) {
  this._db.attachment.get(document._id, name).pipe(pipe);
};

module.exports = Repository;
