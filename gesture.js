// Left arm: elbow 13, wrist 15. Right arm: elbow 14, wrist 16.
const ARMS = [[13, 15], [14, 16]];

export function isVisibleLandmark(point) {
  return point && point.x >= 0 && point.x <= 1 &&
    point.y >= 0 && point.y <= 1 && (point.visibility ?? 1) >= 0.5;
}

// The wrist must clear the elbow line by this share of the forearm, so jitter on the line never counts.
export function wristSide(elbow, wrist) {
  const margin = Math.max(0.01, Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y) * 0.12);
  if (wrist.y < elbow.y - margin) return 'above';
  if (wrist.y > elbow.y + margin) return 'below';
  return null;
}

export function createGestureCounter() {
  let sides;

  function reset() {
    sides = ARMS.map(() => null);
  }

  function update(landmarks) {
    let scored = false;
    let tracking = false;
    ARMS.forEach(([elbowIndex, wristIndex], arm) => {
      const elbow = landmarks?.[elbowIndex];
      const wrist = landmarks?.[wristIndex];
      if (!isVisibleLandmark(elbow) || !isVisibleLandmark(wrist)) {
        sides[arm] = null;
        return;
      }
      tracking = true;
      const side = wristSide(elbow, wrist);
      if (!side) return;
      if (side === 'above' && sides[arm] === 'below') scored = true;
      sides[arm] = side;
    });
    return { scored, tracking };
  }

  reset();
  return { update, reset };
}
