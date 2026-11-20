import assert from 'node:assert/strict';
import test from 'node:test';
import { isDiscoverSetupRequired, isProfileMissing, shouldRetryDiscover, shouldRetryProfile } from '../src/lib/profile-query-state.ts';

test('only an explicit missing-profile response starts setup', () => {
  assert.equal(isProfileMissing({ status: 404 }), true);
  for (const error of [null, undefined, new Error('Offline'), { status: 401 }, { status: 403 }, { status: 500 }]) {
    assert.equal(isProfileMissing(error), false);
  }
});

test('missing profiles and authentication errors are not repeatedly fetched', () => {
  for (const status of [404, 401, 403]) {
    assert.equal(shouldRetryProfile(0, { status }), false);
  }
});

test('temporary failures get one retry, not an endless loading state', () => {
  for (const error of [new Error('Offline'), { status: 500 }]) {
    assert.equal(shouldRetryProfile(0, error), true);
    assert.equal(shouldRetryProfile(1, error), false);
  }
});

test('Discover opens setup only for its missing-profile response', () => {
  assert.equal(isDiscoverSetupRequired({ status: 409 }), true);
  assert.equal(shouldRetryDiscover(0, { status: 409 }), false);
  for (const error of [null, undefined, new Error('Offline'), { status: 400 }, { status: 401 }, { status: 403 }, { status: 404 }, { status: 500 }]) {
    assert.equal(isDiscoverSetupRequired(error), false);
  }
  assert.equal(shouldRetryDiscover(0, { status: 500 }), true);
  assert.equal(shouldRetryDiscover(1, { status: 500 }), false);
  assert.equal(shouldRetryDiscover(0, { status: 401 }), true);
  assert.equal(shouldRetryDiscover(1, { status: 401 }), true);
  assert.equal(shouldRetryDiscover(2, { status: 401 }), false);
  assert.equal(shouldRetryDiscover(0, { status: 403 }), false);
});
