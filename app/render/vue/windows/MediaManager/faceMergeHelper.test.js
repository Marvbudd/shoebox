import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAssignedFacesIntoCurrent } from './faceMergeHelper.js';

test('mergeAssignedFacesIntoCurrent preserves disjoint assigned and unresolved sets', () => {
  const currentDetectedFaces = [
    { region: { x: 0.10, y: 0.10, w: 0.05, h: 0.05 }, descriptor: [1], confidence: 0.9, model: 'ssd' },
    { region: { x: 0.20, y: 0.10, w: 0.05, h: 0.05 }, descriptor: [2], confidence: 0.9, model: 'ssd' },
    { region: { x: 0.30, y: 0.10, w: 0.05, h: 0.05 }, descriptor: [3], confidence: 0.9, model: 'ssd' }
  ];

  const currentUnmatchedFaces = [
    { faceIndex: 0, region: currentDetectedFaces[0].region, confidence: 0.9 },
    { faceIndex: 1, region: currentDetectedFaces[1].region, confidence: 0.9 },
    { faceIndex: 2, region: currentDetectedFaces[2].region, confidence: 0.9 }
  ];

  const loadedDetectedFaces = [
    { region: { x: 0.60, y: 0.10, w: 0.05, h: 0.05 }, descriptor: [4], confidence: 0.95, model: 'ssd' }
  ];

  const loadedMatchedFaces = [
    { faceIndex: 0, personID: 'person-1', region: loadedDetectedFaces[0].region, confidence: 0.95 }
  ];

  const merged = mergeAssignedFacesIntoCurrent({
    currentDetectedFaces,
    currentMatchedFaces: [],
    currentUnmatchedFaces,
    loadedDetectedFaces,
    loadedMatchedFaces
  });

  assert.equal(merged.detectedFaces.length, 4);
  assert.equal(merged.matchedFaces.length, 1);
  assert.equal(merged.unmatchedFaces.length, 3);
  assert.equal(merged.matchedFaces[0].personID, 'person-1');
  assert.equal(merged.matchedFaces[0].faceIndex, 3);
  assert.equal(merged.overlapCount, 0);
});

test('mergeAssignedFacesIntoCurrent drops overlapping unresolved entry as defensive fallback', () => {
  const sharedRegion = { x: 0.10, y: 0.10, w: 0.05, h: 0.05 };

  const currentDetectedFaces = [
    { region: sharedRegion, descriptor: [1], confidence: 0.9, model: 'ssd' }
  ];

  const currentUnmatchedFaces = [
    { faceIndex: 0, region: sharedRegion, confidence: 0.9 }
  ];

  const loadedDetectedFaces = [
    { region: sharedRegion, descriptor: [1], confidence: 0.95, model: 'ssd' }
  ];

  const loadedMatchedFaces = [
    { faceIndex: 0, personID: 'person-overlap', region: sharedRegion, confidence: 0.95 }
  ];

  const merged = mergeAssignedFacesIntoCurrent({
    currentDetectedFaces,
    currentMatchedFaces: [],
    currentUnmatchedFaces,
    loadedDetectedFaces,
    loadedMatchedFaces
  });

  assert.equal(merged.detectedFaces.length, 1);
  assert.equal(merged.matchedFaces.length, 1);
  assert.equal(merged.matchedFaces[0].faceIndex, 0);
  assert.equal(merged.unmatchedFaces.length, 0);
  assert.equal(merged.overlapCount, 1);
});

test('mergeAssignedFacesIntoCurrent matches near-identical regions with small numeric drift', () => {
  const candidateRegion = { x: 0.401234, y: 0.512345, w: 0.091234, h: 0.121234 };
  const assignedRegion = { x: 0.401235, y: 0.512344, w: 0.091235, h: 0.121233 };

  const currentDetectedFaces = [
    { region: candidateRegion, descriptor: [1], confidence: 0.9, model: 'ssd' }
  ];

  const currentUnmatchedFaces = [
    { faceIndex: 0, region: candidateRegion, confidence: 0.9 }
  ];

  const loadedDetectedFaces = [
    { region: assignedRegion, descriptor: [1], confidence: 0.95, model: 'ssd' }
  ];

  const loadedMatchedFaces = [
    { faceIndex: 0, personID: 'person-drift', region: assignedRegion, confidence: 0.95 }
  ];

  const merged = mergeAssignedFacesIntoCurrent({
    currentDetectedFaces,
    currentMatchedFaces: [],
    currentUnmatchedFaces,
    loadedDetectedFaces,
    loadedMatchedFaces
  });

  assert.equal(merged.detectedFaces.length, 1);
  assert.equal(merged.matchedFaces.length, 1);
  assert.equal(merged.matchedFaces[0].faceIndex, 0);
  assert.equal(merged.unmatchedFaces.length, 0);
  assert.equal(merged.overlapCount, 1);
});

test('mergeAssignedFacesIntoCurrent keeps nearby non-identical face unresolved', () => {
  const assignedRegion = { x: 0.40, y: 0.50, w: 0.08, h: 0.10 };
  const nearbyOtherFace = { x: 0.46, y: 0.50, w: 0.08, h: 0.10 };

  const currentDetectedFaces = [
    { region: assignedRegion, descriptor: [1], confidence: 0.9, model: 'ssd' },
    { region: nearbyOtherFace, descriptor: [2], confidence: 0.9, model: 'ssd' }
  ];

  const currentUnmatchedFaces = [
    { faceIndex: 0, region: assignedRegion, confidence: 0.9 },
    { faceIndex: 1, region: nearbyOtherFace, confidence: 0.9 }
  ];

  const loadedDetectedFaces = [
    { region: assignedRegion, descriptor: [1], confidence: 0.95, model: 'ssd' }
  ];

  const loadedMatchedFaces = [
    { faceIndex: 0, personID: 'person-nearby', region: assignedRegion, confidence: 0.95 }
  ];

  const merged = mergeAssignedFacesIntoCurrent({
    currentDetectedFaces,
    currentMatchedFaces: [],
    currentUnmatchedFaces,
    loadedDetectedFaces,
    loadedMatchedFaces
  });

  assert.equal(merged.detectedFaces.length, 2);
  assert.equal(merged.matchedFaces.length, 1);
  assert.equal(merged.unmatchedFaces.length, 1);
  assert.equal(merged.unmatchedFaces[0].faceIndex, 1);
  assert.equal(merged.overlapCount, 1);
});

test('mergeAssignedFacesIntoCurrent does not map two assigned people to one detection index', () => {
  const regionA = { x: 0.30, y: 0.50, w: 0.08, h: 0.10 };
  const regionB = { x: 0.60, y: 0.50, w: 0.08, h: 0.10 };

  const currentDetectedFaces = [
    { region: regionA, descriptor: [1], confidence: 0.9, model: 'ssd' },
    { region: regionB, descriptor: [2], confidence: 0.9, model: 'ssd' }
  ];

  const merged = mergeAssignedFacesIntoCurrent({
    currentDetectedFaces,
    currentMatchedFaces: [],
    currentUnmatchedFaces: [],
    loadedDetectedFaces: [
      { region: regionA, descriptor: [1], confidence: 0.95, model: 'ssd' },
      { region: regionB, descriptor: [2], confidence: 0.95, model: 'ssd' }
    ],
    loadedMatchedFaces: [
      { faceIndex: 0, personID: 'person-a', region: regionA, confidence: 0.95 },
      { faceIndex: 1, personID: 'person-b', region: regionB, confidence: 0.95 }
    ]
  });

  assert.equal(merged.matchedFaces.length, 2);
  assert.notEqual(merged.matchedFaces[0].faceIndex, merged.matchedFaces[1].faceIndex);
});
