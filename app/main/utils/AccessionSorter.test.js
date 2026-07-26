import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessionSorter } from './AccessionSorter.js';

test('sortByDate orders same-day items by time when available', () => {
  const sorter = new AccessionSorter();
  const sorted = sorter.sortByDate([
    {
      accession: '2',
      link: 'later.jpg',
      type: 'photo',
      person: [],
      date: { year: 2024, month: 'Jan', day: 2, time: '15:00:00' }
    },
    {
      accession: '1',
      link: 'earlier.jpg',
      type: 'photo',
      person: [],
      date: { year: 2024, month: 'Jan', day: 2, time: '09:30:00' }
    }
  ]);

  assert.deepEqual(sorted.map(item => item.link), ['earlier.jpg', 'later.jpg']);
});