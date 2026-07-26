import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildDateParts,
  enrichExistingDateWithTime,
  normalizeDateValue,
  resolveAccessionsFilePath,
  sameCalendarDate,
  validateMediaDirectory
} from './helpers.js';

test('normalizeDateValue accepts common date strings and Date objects', () => {
  const fromExif = normalizeDateValue('2024:01:02 03:04:05');
  assert.ok(fromExif instanceof Date);
  assert.equal(fromExif.getFullYear(), 2024);

  const fromIso = normalizeDateValue('2024-01-02T03:04:05');
  assert.ok(fromIso instanceof Date);
  assert.equal(fromIso.getUTCFullYear(), 2024);

  const fromDate = normalizeDateValue(new Date('2024-01-02T03:04:05Z'));
  assert.ok(fromDate instanceof Date);
  assert.equal(fromDate.getUTCFullYear(), 2024);
});

test('buildDateParts includes time only when requested', () => {
  const dateParts = buildDateParts(new Date(2024, 0, 2, 3, 4, 5), { includeTime: true });
  assert.equal(dateParts.year, 2024);
  assert.equal(dateParts.month, 'Jan');
  assert.equal(dateParts.day, 2);
  assert.equal(dateParts.time, '03:04:05');
});

test('enrichExistingDateWithTime adds time only when the calendar date matches', () => {
  const updatedDate = enrichExistingDateWithTime(
    { year: 2024, month: 'Jan', day: 2 },
    new Date(2024, 0, 2, 3, 4, 5),
    true
  );

  assert.deepEqual(updatedDate, {
    year: 2024,
    month: 'Jan',
    day: 2,
    time: '03:04:05'
  });

  assert.equal(
    sameCalendarDate({ year: 2024, month: 'Jan', day: 2 }, new Date(2024, 0, 3, 3, 4, 5)),
    false
  );

  assert.equal(
    enrichExistingDateWithTime(
      { year: 2024, month: 'Jan', day: 2 },
      new Date(2024, 0, 3, 3, 4, 5),
      true
    ),
    null
  );
});

test('resolveAccessionsFilePath uses the selected directory as the archive root', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoebox-helpers-'));
  const archiveRoot = path.join(tempDir, 'archive');
  fs.mkdirSync(archiveRoot, { recursive: true });

  const accessionsPath = path.join(archiveRoot, 'accessions.json');
  fs.writeFileSync(accessionsPath, '{}');
  assert.equal(resolveAccessionsFilePath(archiveRoot), accessionsPath);
});

test('resolveAccessionsFilePath preserves an explicit accessions.json file path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoebox-helpers-'));
  const archiveRoot = path.join(tempDir, 'archive');
  fs.mkdirSync(archiveRoot, { recursive: true });

  const accessionsPath = path.join(archiveRoot, 'accessions.json');
  fs.writeFileSync(accessionsPath, '{}');
  assert.equal(resolveAccessionsFilePath(accessionsPath), accessionsPath);
});

test('validateMediaDirectory reports missing media folders clearly', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoebox-media-'));
  const result = validateMediaDirectory(tempDir);
  assert.equal(result.valid, false);
  assert.match(result.reason, /photo|audio|video/);
});

test('validateMediaDirectory succeeds when all required media folders exist', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoebox-media-'));
  for (const folder of ['photo', 'audio', 'video']) {
    fs.mkdirSync(path.join(tempDir, folder), { recursive: true });
  }

  const result = validateMediaDirectory(tempDir);
  assert.equal(result.valid, true);
  assert.match(result.reason, /Found media folders/);
});
