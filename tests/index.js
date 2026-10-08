'use strict';
// Entry point for `node --test tests/`. On Node 22 a directory argument is
// loaded as a module, so this file loads the test suite. `npm test` runs the
// same tests through the tests/*.test.js glob.
require('./model.test.js');
