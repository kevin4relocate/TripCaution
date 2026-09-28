import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_DESTINATIONS, CONTINENT_ORDER, groupDestinationsByContinent } from '../src/destinations.js';

test('starter countries appear in continent sections and alphabetical order', () => {
  const groups = groupDestinationsByContinent(STARTER_DESTINATIONS);
  assert.deepEqual(groups.map(group => group.continent), ['Asia','Europe','North America']);
  assert.deepEqual(groups.find(group => group.continent === 'Asia').countries,
    ['Cambodia','Indonesia','Japan','Laos','Malaysia','Singapore','Thailand','Vietnam']);
  assert.deepEqual(groups.find(group => group.continent === 'Europe').countries,
    ['France','Italy','Spain']);
  assert.deepEqual(groups.find(group => group.continent === 'North America').countries,
    ['United States']);
});

test('published new destinations are included, deduplicated and grouped', () => {
  const groups = groupDestinationsByContinent([...STARTER_DESTINATIONS,'Canada','canada','Brazil','Australia','Kenya','Atlantis']);
  assert.equal(groups.find(group => group.continent === 'North America').countries.filter(x => x.toLowerCase() === 'canada').length, 1);
  assert.deepEqual(groups.slice(3).map(group => group.continent),['South America','Africa','Oceania','Other destinations']);
  assert.deepEqual(groups.find(group => group.continent === 'Other destinations').countries,['Atlantis']);
  assert.equal(groups.flatMap(group => group.countries).length, STARTER_DESTINATIONS.length + 5);
});

test('empty and invalid country names do not create sections', () => {
  assert.deepEqual(groupDestinationsByContinent(['',null,'  ',undefined]),[]);
  assert.deepEqual(CONTINENT_ORDER.slice(0,2),['Asia','Europe']);
});
