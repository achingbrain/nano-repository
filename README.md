# nano-repository

[![Build Status](https://travis-ci.org/achingbrain/nano-repository.svg)](https://travis-ci.org/achingbrain/nano-repository) [![Dependency Status](https://david-dm.org/achingbrain/nano-repository.svg)](https://david-dm.org/achingbrain/nano-repository) [![Coverage Status](https://img.shields.io/coveralls/achingbrain/nano-repository/master.svg)](https://coveralls.io/r/achingbrain/nano-repository)

Working with CouchDB is a pretty pleasant experience, mostly because of the rather excellent [nano](https://github.com/dscape/nano) library.

There are a couple of rough edges though, so what else could be better but an abstracton on top of an abstraction!

## Examples

Create me a repository:

```javascript
var Nano = require('nano'),
  Repository = require('nano-repository');

// set up Nano
var connection = new Nano('http://localhost:5984');
var db = connection.db.create('my_db');

// set up repo
var repository = new Repository(db);

```

### CRUD operations

```javascript
var document = {foo: 'bar'};

// create
repository.save(document, function(error, result) {
    // document now has _id, _rev and created_at properties
});

// retrieve
repository.findById(id, function(error, document) {
    // document has been fetched
});

// update
repository.save(document, function(error, result) {
    // if previously saved, document now has updated_at properties
    // and _rev has been incremented
});

// delete
repository.remove(document, function(error) {
    // document has been deleted
});
```

### Attachments

Add files to your documents:

```javascript
repository.addAttachment(document, attachmentName, pathToFile, mimeType, function(error, body) {
  // file has now been attached
});
```

Retrieve attachments:

```javascript
repository.findAttachment(document, name, function(error, body) {
  // body contains the attachment data
});
```

### Attachment versions

The attachment version is dependent on the document version.  E.g if you will pardon the pyramid of doom:

```javascript
var attachmentName = 'myFile';

// add the first version of the attachment
repository.addAttachment(document, attachmentName, pathToFile, mimeType, function(error, body) {
  // now document._rev = 2

  // add the second it again:
  repository.addAttachment(document, attachmentName, pathToFile, mimeType, function(error, body) {
    // now document._rev = 3

    // we now have two revisions of 'myFile' that we can access:
    repository.findAttachment({_id: document._id, _rev: 2}, attachmentName, function(error, body) {
      // body contains the first version of myFile
    });
    repository.findAttachment({_id: document._id, _rev: 3}, attachmentName, function(error, body) {
      // body contains the second version
    });
  });
});
```

#### Streaming attachments

For the performance/memory conscious, stream files to your documents with the 4x argument version of Repository.addAttachment:

```javascript
var fileStream = fs.createReadStream(pathToFile);

fileStream.pipe(repository.addAttachment(document, attachmentName, mimeType, function(error, body) {
  // file has now been attached
}));
```

...and retrieve them:

```javascript
repository.streamAttachmentTo(document, name, writeStream);
```

### Views

Views are accessed by extra methods on the Repository.  To create your views, first create a view template file, usally with the `.json` extension.

The template file looks like this (n.b. feel free to include `reduce` functions if you need them):

```javascript
{
  "views": {
    "all": {
      "map": "function(doc) {if(doc.name) emit(null, doc)}"
    },
    "byName": {
      "map": "function(doc) {if(doc.name) emit(doc.name, doc)}"
    }
  }
}
```

Update/create the views:

```javascript
var repository = new Repository(db);
repository.updateViews('path/to/views.json', function(error) {
  // views are now ready to use
});
```

View methods are dynamically created:

```javascript
repository.findAll(function(error, list) {
  // list contains all documents from this collection
});
```

Method names are chosen by capitalising the first letter of the view name and prepending `find` to it.

So the view mapping file contained a view named `all` - this was turned into `findAll`, similarly the view named `byName` was turned into a method named `findByName`.

Arguments are also supported:

```javascript
repository.findByName('bob', function(error, list) {
  // list contains all documents where doc.name == 'bob'
});
```

The code that makes up your view is hashed - the hash is stored along with the views.  The next time you call Repository.updateViews the hashes are compared - it they've changed then the views are recreated automatically.

This means it's save to call Repository.updateViews every time you start your app - they'll only get altered if you change the code in your view file.

## Get out of my console.log

You can pass an alternative logging implementation into the constructor and the repository will use that instead, as long as it supports `.info`, `.warn`, etc methods.

```javascript
var Nano = require('nano'),
  Logger = require('winston').Logger,
  logger = new Logger(..);

//.. set up Nano as usual

var repository = new Repository(db, logger);
```

## Todo

1. Retrieving specific document versions.
3. Work out if I've missed the point somehow. Probably.
