const Lego = require('../src/lego.js');
const assert = require('assert');

describe('transaction', function () {
	beforeEach(function () {
		return Lego.sql `CREATE TABLE tests (text TEXT UNIQUE, value INTEGER)`;
	});

	afterEach(function () {
		return Lego.sql `DROP TABLE IF EXISTS tests`;
	});

	it('can commit', function () {
		return Lego.transaction(function (lego) {
				return Lego.sql `INSERT INTO tests (text, value) VALUES ('Martijn', 123) RETURNING *`
					.then(function (tests) {
						assert.equal(tests.length, 1);
						assert.equal(tests[0].text, 'Martijn');
						assert.equal(tests[0].value, 123);
					});
			})
			.then(function () {
				return Lego.sql `SELECT * FROM tests`;
			})
			.then(function (tests) {
				assert.equal(tests.length, 1);
				assert.equal(tests[0].text, 'Martijn');
				assert.equal(tests[0].value, 123);
			});
	});

	it('can rollback', function () {
		return Lego.transaction(function (lego) {
				return lego.sql `INSERT INTO tests (text, value) VALUES ('Martijn', 123) RETURNING *`
					.then(function (tests) {
						assert.equal(tests.length, 1);
						assert.equal(tests[0].text, 'Martijn');
						assert.equal(tests[0].value, 123);

						return lego.sql `INSERT INTO tests (text, value) VALUES ('Martijn', 123) RETURNING *`;
					});
			})
			.then(assert.fail)
			.catch(function (error) {
				assert.equal(error.code, '23505');

				return Lego.sql `SELECT * FROM tests`
					.then(function (tests) {
						assert.equal(tests.length, 0);
					});
			});
	});

	it('throw error if not returning promise', function () {
		return Lego.transaction(function () {
				// We return nothing so this fails.
			})
			.then(assert.fail)
			.catch(function (error) {
				assert.equal(error.message, 'In Lego#transaction(..) you must return a Promise.');
			});
	});
});
