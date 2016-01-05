'use strict';

const assert = require('assert');
const sinon = require('sinon');
let fs = require('fs');
const Lego = require('..');

describe('migrations', function() {
	var sandbox = null;

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	it('can read current version from fs', function() {
		sandbox.stub(fs, 'readdir', function(path, callback) {
			callback(null, ['002.js', '001.js']);
		});

		return Lego.Migrations.getCurrentVersion()
			.then(function(version) {
				assert.equal(version, 2);
			});
	});

	it('fail with invalid migration file', function() {
		sandbox.stub(fs, 'readdir', function(path, callback) {
			callback(null, ['test.js', '001.js']);
		});

		return Lego.Migrations.getCurrentVersion()
			.then(assert.fail)
			.catch(function(error) {
				assert.equal(error.message, 'Unknown file `test.js` in migrations folder.');
			});
	});

	it('read current version if migrations does not exist', function() {
		sandbox.stub(fs, 'readdir', function(path, callback) {
			var error = new Error('no such file or directory');
			error.errno = -2;
			error.code = 'ENOENT';
			callback(error);
		});

		return Lego.Migrations.getCurrentVersion()
			.then(function(version) {
				assert.equal(version, 0);
			});
	});

	it('fail get current version', function() {
		sandbox.stub(fs, 'readdir', function(path, callback) {
			var error = new Error('unknown error');
			callback(error);
		});

		return Lego.Migrations.getCurrentVersion()
			.then(assert.fail)
			.catch(function(error) {
				assert.equal(error.message, 'unknown error');
			});
	});

	it('can create migration', function() {
		sandbox.stub(fs, 'mkdir', function(path, callback) {
			callback(null);
		});

		sandbox.stub(fs, 'writeFile', function(path, data, callback) {
			callback(null);
		});

		return Lego.Migrations.createMigration(1)
			.then(function(fileName) {
				assert.equal(fileName, '001.js');
			});
	});

	it('can create migration if folder already exists', function() {
		sandbox.stub(fs, 'mkdir', function(path, callback) {
			var error = new Error('file already exists');
			error.errno = -17;
			error.code = 'EEXIST';
			callback(error);
		});

		sandbox.stub(fs, 'writeFile', function(path, data, callback) {
			callback(null);
		});

		return Lego.Migrations.createMigration(1)
			.then(function(fileName) {
				assert.equal(fileName, '001.js');
			});
	});

	describe('empty database', function() {
		afterEach(function() {
			return Lego.new `DROP SCHEMA IF EXISTS lego CASCADE`;
		});

		it('can get database version', function() {
			return Lego.Migrations.getDatabaseVersion()
				.then(function(version) {
					assert.equal(version, 0);
				});
		});

		it('create migrations table', function() {
			return Lego.Migrations.createMigrationsTable()
				.then(function() {
					return Lego.new `SELECT * FROM lego.migrations`;
				})
				.then(function(migrations) {
					assert.equal(migrations.length, 0);
				});
		});

		it('can create migrations table twice', function() {
			return Lego.Migrations.createMigrationsTable()
				.then(function() {
					return Lego.Migrations.createMigrationsTable();
				});
		});
	});

	describe('going up', function() {
		beforeEach(function() {
			sandbox.stub(Lego.Migrations, 'loadMigration', function(version) {
				if(version === 1) {
					return {
						up: function(lego, queue) {
							queue.add `CREATE TABLE tests (name TEXT, value INTEGER)`;
						},

						down: function(lego, queue) {
							queue.add `DROP TABLE tests`;
						}
					};
				}
				else if(version === 2) {
					return {
						up: function(lego, queue) {
							let name = 'Martijn';
							let value = 654;

							queue.add `INSERT INTO tests (name, value) VALUES (${name}, ${value})`;
						},

						down: function(lego, queue) {
							queue.add `DELETE FROM tests WHERE value = 654`;
						}
					};
				}
				else if(version === 3) {
					return {
						up: function() {
							//
						},

						down: function() {
							//
						}
					};
				}
			});
		});

		afterEach(function() {
			return Lego.new `DROP TABLE IF EXISTS tests`
				.then(function() {
					return Lego.new `DROP SCHEMA IF EXISTS lego CASCADE`;
				});
		});

		it('empty to 1', function() {
			return Lego.Migrations.migrate(0, 1)
				.then(function() {
					return Lego.Migrations.getDatabaseVersion();
				})
				.then(function(databaseVersion) {
					assert.equal(databaseVersion, 1);
				})
				.then(function() {
					return Lego.new `SELECT * FROM tests`;
				})
				.then(function(tests) {
					assert.equal(tests.length, 0);
				});
		});

		it('empty to 1 to empty', function() {
			return Lego.Migrations.migrate(0, 1)
				.then(function() {
					return Lego.Migrations.migrate(1, 0);
				})
				.then(function() {
					return Lego.Migrations.getDatabaseVersion();
				})
				.then(function(databaseVersion) {
					assert.equal(databaseVersion, 0);
				})
				.then(function() {
					return Lego.new `SELECT * FROM tests`;
				})
				.then(assert.fail)
				.catch(function(error) {
					assert.equal(error.code, '42P01');
				});
		});

		it('empty to 2 to empty', function() {
			return Lego.Migrations.migrate(0, 2)
				.then(function() {
					return Lego.Migrations.migrate(2, 0);
				})
				.then(function() {
					return Lego.Migrations.getDatabaseVersion();
				})
				.then(function(databaseVersion) {
					assert.equal(databaseVersion, 0);
				})
				.then(function() {
					return Lego.new `SELECT * FROM tests`;
				})
				.then(assert.fail)
				.catch(function(error) {
					assert.equal(error.code, '42P01');
				});
		});

		it('empty to 3 to empty', function() {
			return Lego.Migrations.migrate(0, 3)
				.then(function() {
					return Lego.Migrations.migrate(3, 0);
				})
				.then(function() {
					return Lego.Migrations.getDatabaseVersion();
				})
				.then(function(databaseVersion) {
					assert.equal(databaseVersion, 0);
				})
				.then(function() {
					return Lego.new `SELECT * FROM tests`;
				})
				.then(assert.fail)
				.catch(function(error) {
					assert.equal(error.code, '42P01');
				});
		});
	});
});