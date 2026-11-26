import assert from 'node:assert/strict';
import test from 'node:test';
import { assignPlayers, closestPoses, comboLevel, createGestureCounter } from './gesture.js';

// Elbows sit at y = 0.46; smaller y is higher on screen.
function arms(leftWristY, rightWristY) {
  const landmarks = [];
  landmarks[13] = { x: 0.69, y: 0.46, visibility: 1 };
  landmarks[14] = { x: 0.31, y: 0.46, visibility: 1 };
  landmarks[15] = { x: 0.80, y: leftWristY, visibility: 1 };
  landmarks[16] = { x: 0.20, y: rightWristY, visibility: 1 };
  return landmarks;
}

const leftUp = arms(0.38, 0.54);
const rightUp = arms(0.54, 0.38);
const bothDown = arms(0.54, 0.54);
const onTheLine = arms(0.465, 0.455);

test('scores each time a wrist rises past its elbow line', () => {
  const gesture = createGestureCounter();

  assert.deepEqual(gesture.update(bothDown), { scored: false, tracking: true });
  assert.equal(gesture.update(leftUp).scored, true);
  assert.equal(gesture.update(leftUp).scored, false);
  assert.equal(gesture.update(rightUp).scored, true);
  assert.equal(gesture.update(leftUp).scored, true);
  assert.equal(gesture.update(bothDown).scored, false);
});

test('ignores the first pose and jitter on the line', () => {
  const gesture = createGestureCounter();

  assert.equal(gesture.update(leftUp).scored, false);
  assert.equal(gesture.update(onTheLine).scored, false);
  assert.equal(gesture.update(leftUp).scored, false);
  assert.equal(gesture.update(onTheLine).scored, false);
  assert.equal(gesture.update(bothDown).scored, false);
  assert.equal(gesture.update(onTheLine).scored, false);
  assert.equal(gesture.update(leftUp).scored, true);
});

test('forgets an arm that leaves the frame or after a restart', () => {
  const gesture = createGestureCounter();
  const leftHidden = arms(0.54, 0.54);
  leftHidden[15].visibility = 0.2;

  gesture.update(bothDown);
  assert.deepEqual(gesture.update(leftHidden), { scored: false, tracking: true });
  assert.equal(gesture.update(leftUp).scored, false);
  assert.deepEqual(gesture.update(undefined), { scored: false, tracking: false });

  gesture.update(bothDown);
  gesture.reset();
  assert.equal(gesture.update(rightUp).scored, false);
});

test('splits battle players by the half of the mirrored screen they stand in', () => {
  // Camera x 0.75 shows on the left of the mirrored screen.
  const person = (x, width = 0.1) => {
    const pose = [];
    pose[11] = { x: x + width / 2, y: 0.3 };
    pose[12] = { x: x - width / 2, y: 0.3 };
    return pose;
  };
  const onLeft = person(0.75);
  const onRight = person(0.25);

  assert.deepEqual(assignPlayers([onRight, onLeft]), [onLeft, onRight]);
  assert.deepEqual(assignPlayers([onRight]), [undefined, onRight]);
  assert.deepEqual(assignPlayers([onLeft]), [onLeft, undefined]);
  assert.deepEqual(assignPlayers([]), [undefined, undefined]);
  assert.deepEqual(assignPlayers(undefined), [undefined, undefined]);

  const background = person(0.5, 0.03);
  assert.deepEqual(assignPlayers([background, onRight, onLeft]), [onLeft, onRight]);
  assert.deepEqual(closestPoses([background, onRight]), [onRight]);
});

test('makes the hands take turns', () => {
  const gesture = createGestureCounter();
  gesture.update(bothDown);
  assert.equal(gesture.update(leftUp).scored, true);
  assert.equal(gesture.update(bothDown).scored, false);
  assert.equal(gesture.update(leftUp).scored, false);
  assert.equal(gesture.update(bothDown).scored, false);
  assert.equal(gesture.update(rightUp).scored, true);
});

test('heats up with fast points and cools down when they stop', () => {
  assert.equal(comboLevel([], 0), 0);
  assert.equal(comboLevel([0, 300, 600], 700), 1);
  assert.equal(comboLevel([0, 300, 600, 900, 1200], 1300), 2);
  assert.equal(comboLevel([0, 250, 500, 750, 1000, 1250, 1500], 1600), 3);
  assert.equal(comboLevel([0, 250, 500, 750, 1000, 1250, 1500], 3400), 0);
});

test('keeps the final moment and spreads the others', async () => {
  const { pickMoments } = await import('./moments.js');
  const shots = Array.from({ length: 20 }, (_, index) => index);
  const picked = pickMoments(shots);
  assert.equal(picked.length, 8);
  assert.equal(picked[0], 0);
  assert.equal(picked.at(-1), 19);
  assert.deepEqual(pickMoments([1, 2]), [1, 2]);
});
