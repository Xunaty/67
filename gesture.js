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

const shoulderWidth = (pose) => Math.hypot(pose[11].x - pose[12].x, pose[11].y - pose[12].y);

// People closest to the camera look biggest, so this skips whoever walks by in the background.
export function closestPoses(poses = [], count = 1) {
  return [...poses].sort((a, b) => shoulderWidth(b) - shoulderWidth(a)).slice(0, count);
}

// Battle mode: player 1 owns the left half of the mirrored screen, player 2 the right half.
export function assignPlayers(poses = []) {
  const players = [undefined, undefined];
  const placed = closestPoses(poses, 2)
    .map((pose) => ({ pose, screenX: 1 - (pose[11].x + pose[12].x) / 2 }))
    .sort((a, b) => a.screenX - b.screenX);
  if (placed.length >= 2) [players[0], players[1]] = [placed[0].pose, placed[1].pose];
  else if (placed.length === 1) players[placed[0].screenX < 0.5 ? 0 : 1] = placed[0].pose;
  return players;
}

export const COMBO_WINDOW_MS = 2000;

// Fire level from how many points landed in the last two seconds: 0 none, 1 warm, 2 fire, 3 infinite aura.
export function comboLevel(pointTimes, now) {
  const recent = pointTimes.filter((time) => now - time < COMBO_WINDOW_MS).length;
  return recent >= 7 ? 3 : recent >= 5 ? 2 : recent >= 3 ? 1 : 0;
}

export function createGestureCounter() {
  let sides;
  let lastArm;

  function reset() {
    sides = ARMS.map(() => null);
    lastArm = null;
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
      // The hands must take turns, so flapping one hand only scores once.
      if (side === 'above' && sides[arm] === 'below' && arm !== lastArm) {
        scored = true;
        lastArm = arm;
      }
      sides[arm] = side;
    });
    return { scored, tracking };
  }

  reset();
  return { update, reset };
}
