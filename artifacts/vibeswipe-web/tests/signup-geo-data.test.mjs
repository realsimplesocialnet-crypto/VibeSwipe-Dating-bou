import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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

test('signup country selection never requests device location permission', () => {
  const web = readFileSync(new URL('../src/components/onboarding-country-step.tsx', import.meta.url), 'utf8');
  const mobile = readFileSync(new URL('../../vibeswipe/components/OnboardingWizard.tsx', import.meta.url), 'utf8');

  assert.match(web, /level="country"/);
  assert.doesNotMatch(web, /navigator\.geolocation|Detecting your country|enable location access/);
  assert.match(mobile, /SearchInput value=\{search\} onChangeText=\{setSearch\} placeholder="Search all countries"/);
  assert.doesNotMatch(mobile, /expo-location|requestForegroundPermissionsAsync|getCurrentPositionAsync|Open location settings|enable location access/);
});
