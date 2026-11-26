const ARM_LANDMARKS = [11, 12, 13, 14, 15, 16];
const HOLD_MS = 55;
const SWITCH_MS = 145;
const REACQUIRE_MS = 650;

export function isVisibleLandmark(point) {
  return point && point.x >= 0 && point.x <= 1 &&
    point.y >= 0 && point.y <= 1 && (point.visibility ?? 1) >= 0.5;
}

export function createGestureCounter() {
  let previous;
  let candidate;
  let lastStanceAt;

  function reset() {
    previous = null;
    candidate = null;
    lastStanceAt = -Infinity;
  }

  function update(landmarks, now) {
    if (now - lastStanceAt >= REACQUIRE_MS) reset();

    const arms = ARM_LANDMARKS.map((index) => landmarks?.[index]);
    const tracking = arms.every(isVisibleLandmark);
    let stance = null;

    if (tracking) {
      const [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist] = arms;
      const leftHeight = leftShoulder.y - leftWrist.y;
      const rightHeight = rightShoulder.y - rightWrist.y;
      const scale = Math.max(0.07, (leftElbow.y + rightElbow.y -
        leftShoulder.y - rightShoulder.y) / 2);
      const distance = leftHeight - rightHeight;
      const forearmsUp = leftWrist.y <= leftElbow.y + scale * 0.45 &&
        rightWrist.y <= rightElbow.y + scale * 0.45;

      // Pose landmarks measure the seesaw motion; palm rotation needs hand landmarks.
      if (forearmsUp && Math.abs(distance) >= scale * 0.28) {
        stance = { side: Math.sign(distance), leftHeight, rightHeight, scale, now };
      }
    }

    if (!stance) {
      candidate = null;
      return { scored: false, tracking };
    }

    lastStanceAt = now;
    if (stance.side !== candidate?.side) candidate = stance;
    if (now - candidate.now < HOLD_MS) return { scored: false, tracking };

    if (!previous || stance.side === previous.side) {
      previous = { ...stance, now: previous?.now ?? now };
      return { scored: false, tracking };
    }

    const leftTravel = (stance.leftHeight - previous.leftHeight) * stance.side;
    const rightTravel = (previous.rightHeight - stance.rightHeight) * stance.side;
    const minTravel = Math.min(previous.scale, stance.scale) * 0.14;
    const scored = now - previous.now >= SWITCH_MS &&
      leftTravel >= minTravel && rightTravel >= minTravel;

    if (scored) previous = stance;
    return { scored, tracking };
  }

  reset();
  return { update, reset };
}
