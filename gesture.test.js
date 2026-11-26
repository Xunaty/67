import assert from 'node:assert/strict';
import test from 'node:test';
import { createGestureCounter } from './gesture.js';

function arms(leftWristY, rightWristY) {
  const landmarks = [];
  landmarks[11] = { x: 0.65, y: 0.30, visibility: 1 };
  landmarks[12] = { x: 0.35, y: 0.30, visibility: 1 };
  landmarks[13] = { x: 0.69, y: 0.46, visibility: 1 };
  landmarks[14] = { x: 0.31, y: 0.46, visibility: 1 };
  landmarks[15] = { x: 0.71, y: leftWristY, visibility: 1 };
  landmarks[16] = { x: 0.29, y: rightWristY, visibility: 1 };
  return landmarks;
}

const leftUp = arms(0.37, 0.46);
const rightUp = arms(0.46, 0.37);
const bothLevel = arms(0.41, 0.41);

test('scores once per stable side change after the initial stance', () => {
  const gesture = createGestureCounter();

  assert.deepEqual(gesture.update(leftUp, 0), { scored: false, tracking: true });
  assert.equal(gesture.update(leftUp, 65).scored, false);
  assert.equal(gesture.update(bothLevel, 140).scored, false);
  assert.equal(gesture.update(rightUp, 200).scored, false);
  assert.equal(gesture.update(rightUp, 265).scored, true);
  assert.equal(gesture.update(rightUp, 325).scored, false);
  assert.equal(gesture.update(leftUp, 420).scored, false);
  assert.equal(gesture.update(leftUp, 485).scored, true);
});

test('ignores alternating noise, one-hand swings and lowered forearms', () => {
  const gesture = createGestureCounter();

  gesture.update(leftUp, 0);
  gesture.update(leftUp, 65);
  assert.equal(gesture.update(rightUp, 200).scored, false);
  assert.equal(gesture.update(bothLevel, 240).scored, false);
  const oneHandLowered = arms(0.51, 0.46);
  assert.equal(gesture.update(oneHandLowered, 310).scored, false);
  assert.equal(gesture.update(oneHandLowered, 375).scored, false);
  const armsDown = arms(0.65, 0.54);
  assert.equal(gesture.update(armsDown, 425).scored, false);
  assert.equal(gesture.update(armsDown, 490).scored, false);
  assert.equal(gesture.update(rightUp, 530).scored, false);
  assert.equal(gesture.update(rightUp, 595).scored, true);
});

test('reacquires without scoring across a long tracking gap or a restart', () => {
  const gesture = createGestureCounter();
  const wristOutOfFrame = arms(1.08, 0.46);
  const wristOccluded = arms(0.46, 0.37);
  wristOccluded[16].visibility = 0.2;

  gesture.update(leftUp, 0);
  gesture.update(leftUp, 65);
  assert.deepEqual(gesture.update(wristOutOfFrame, 210), { scored: false, tracking: false });
  assert.deepEqual(gesture.update(wristOccluded, 360), { scored: false, tracking: false });
  assert.deepEqual(gesture.update(undefined, 730), { scored: false, tracking: false });
  assert.equal(gesture.update(rightUp, 800).scored, false);
  assert.equal(gesture.update(rightUp, 865).scored, false);
  assert.equal(gesture.update(leftUp, 1040).scored, false);
  assert.equal(gesture.update(leftUp, 1105).scored, true);

  gesture.reset();

  assert.equal(gesture.update(rightUp, 1250).scored, false);
  assert.equal(gesture.update(rightUp, 1315).scored, false);
});
