import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminApplicationDetailQuery } from '../src/routes/admin.js';

test('admin application detail query uses the application id for document lookup', () => {
  const query = getAdminApplicationDetailQuery();

  assert.match(query, /FROM applications a/i);
  assert.match(query, /WHERE a\.id = \$1/i);
  assert.match(query, /a\.id,/i);
  assert.match(query, /s\.full_name/i);
});
