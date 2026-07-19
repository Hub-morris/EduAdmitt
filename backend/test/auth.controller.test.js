import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFingerprint } from '../src/controllers/auth.controller.js';

test('normalizeFingerprint falls back to a safe value when fingerprint is missing', () => {
  assert.equal(normalizeFingerprint(undefined), 'unknown');
  assert.equal(normalizeFingerprint('   '), 'unknown');
  assert.equal(normalizeFingerprint('abc123'), 'abc123');
});
