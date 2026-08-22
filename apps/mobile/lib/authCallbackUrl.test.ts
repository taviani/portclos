import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isAuthCallbackUrl,
  parseAuthCallbackParams,
  parseAuthCallbackUrl,
} from './authCallbackUrl.ts';

describe('parseAuthCallbackUrl', () => {
  it('parses the production custom-scheme redirect', () => {
    const parsed = parseAuthCallbackUrl(
      'portclos://auth/callback?code=abc&state=xyz',
    );
    assert.deepEqual(parsed, { code: 'abc', state: 'xyz' });
    assert.equal(isAuthCallbackUrl('portclos://auth/callback?code=abc'), true);
  });

  it('parses the triple-slash variant', () => {
    const parsed = parseAuthCallbackUrl(
      'portclos:///auth/callback?code=abc&state=xyz',
    );
    assert.deepEqual(parsed, { code: 'abc', state: 'xyz' });
  });

  it('rejects other schemes and paths', () => {
    assert.equal(parseAuthCallbackUrl('https://example.com/auth/callback?code=a'), null);
    assert.equal(parseAuthCallbackUrl('portclos://auth/other?code=a'), null);
    assert.equal(parseAuthCallbackUrl('portclos://auth/callback'), null);
    assert.equal(parseAuthCallbackUrl('not a url'), null);
  });

  it('reads expo-router search params', () => {
    assert.deepEqual(parseAuthCallbackParams({ code: 'a', state: 'b' }), {
      code: 'a',
      state: 'b',
    });
    assert.deepEqual(parseAuthCallbackParams({ code: ['a'], state: ['b'] }), {
      code: 'a',
      state: 'b',
    });
    assert.equal(parseAuthCallbackParams({}), null);
  });
});
