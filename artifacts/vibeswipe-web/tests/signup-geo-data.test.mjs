import assert from 'node:assert/strict';
import test from 'node:test';
import { listCountries, listStates, listCities } from '../src/lib/geo-data.ts';

test('signup offers real countries worldwide, not a small sample list', async () => {
  const countries = await listCountries();
  assert.ok(countries.length > 240);
  for (const code of ['NG', 'US', 'IN', 'BR', 'GB', 'ZA']) {
    assert.ok(countries.some(country => country.code === code));
  }
});

test('Nigeria loads its real states and Lagos loads real cities', async () => {
  const states = await listStates('NG');
  for (const name of ['Lagos', 'Rivers', 'Bayelsa']) {
    assert.ok(states.some(state => state.name.includes(name)));
  }
  const lagos = states.find(state => state.name.includes('Lagos'));
  const cities = await listCities('NG', lagos.code);
  assert.ok(cities.length > 0);
  assert.ok(cities.some(city => /Lagos|Ikeja/i.test(city.name)));
});
