import { isVisibleLandmark, wristSide } from './gesture.js';

const arms = [
  { joints: [11, 13, 15], color: '#e6fa77' },
  { joints: [12, 14, 16], color: '#c5a8ff' },
];

export function createArmOverlay(canvas, video) {
  const context = canvas.getContext('2d');
  let poses = [];
  let poseColors = [];
  let poseHeat = [];
  let flames = [];
  let lastDraw = performance.now();

  function draw() {
    if (!context) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.resetTransform();
    context.clearRect(0, 0, pixelWidth, pixelHeight);

    const { videoWidth, videoHeight } = video;
    if (!width || !height || !videoWidth || !videoHeight) return;

    const scale = Math.min(width / videoWidth, height / videoHeight);
    const imageWidth = videoWidth * scale;
    const imageHeight = videoHeight * scale;
    const left = (width - imageWidth) / 2;
    const top = (height - imageHeight) / 2;
    context.scale(pixelWidth / width, pixelHeight / height);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const now = performance.now();
    const elapsed = Math.min(0.1, (now - lastDraw) / 1000);
    lastDraw = now;
    const toScreen = ({ x, y }) => [left + (1 - x) * imageWidth, top + y * imageHeight];

    // Fire grows from the wrists with the combo level; level 3 sets the shoulders on fire too.
    poses.forEach((landmarks, pose) => {
      const heat = poseHeat[pose] ?? 0;
      if (!landmarks || !heat) return;
      const sources = heat === 3 ? [15, 16, 11, 12] : [15, 16];
      for (const joint of sources) {
        if (!isVisibleLandmark(landmarks[joint])) continue;
        const [x, y] = toScreen(landmarks[joint]);
        for (let count = 0; count < heat * 3; count += 1) {
          flames.push({
            x: x + (Math.random() - 0.5) * 18, y,
            vx: (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 120 * heat,
            life: 1, size: 6 + Math.random() * 8 * heat,
          });
        }
      }
    });
    flames = flames.slice(-900).filter((flame) => {
      flame.life -= elapsed * 1.8;
      flame.x += flame.vx * elapsed;
      flame.y += flame.vy * elapsed;
      return flame.life > 0;
    });
    context.globalCompositeOperation = 'lighter';
    for (const flame of flames) {
      const hue = 10 + flame.life * 45;
      context.fillStyle = `hsla(${hue}, 100%, ${45 + flame.life * 25}%, ${flame.life * 0.55})`;
      context.beginPath();
      context.arc(flame.x, flame.y, flame.size * flame.life, 0, 2 * Math.PI);
      context.fill();
    }
    context.globalCompositeOperation = 'source-over';

    poses.forEach((landmarks, pose) => arms.forEach(({ joints, color: armColor }) => {
      if (!landmarks) return;
      const color = poseColors[pose] ?? armColor;
      if (!joints.every((joint) => isVisibleLandmark(landmarks[joint]))) return;
      const points = joints.map((joint) => toScreen(landmarks[joint]));

      // Elbow line: the wrist scores when it rises past it, and the line lights up while it is above.
      const [elbowX, elbowY] = points[1];
      const reach = Math.max(40, Math.hypot(points[2][0] - elbowX, points[2][1] - elbowY) * 1.3);
      const above = wristSide(landmarks[joints[1]], landmarks[joints[2]]) === 'above';
      context.beginPath();
      context.moveTo(elbowX - reach, elbowY);
      context.lineTo(elbowX + reach, elbowY);
      context.setLineDash([]);
      context.lineWidth = 6;
      context.strokeStyle = '#151027';
      context.stroke();
      context.lineWidth = 3;
      context.strokeStyle = above ? color : '#fcf7ffb3';
      context.stroke();

      context.beginPath();
      context.moveTo(...points[0]);
      context.lineTo(...points[1]);
      context.lineTo(...points[2]);
      context.setLineDash([7, 9]);
      context.lineWidth = 7;
      context.strokeStyle = '#151027';
      context.stroke();
      context.lineWidth = 4;
      context.strokeStyle = color;
      context.stroke();

      context.setLineDash([]);
      context.lineWidth = 2;
      context.strokeStyle = '#151027';
      context.fillStyle = color;
      for (const [x, y] of points) {
        context.beginPath();
        context.arc(x, y, 5, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
      }
    }));
  }

  new ResizeObserver(draw).observe(canvas);

  return {
    // Each pose uses its own color when given one, otherwise one color per arm; heat is its fire level.
    update(nextPoses = [], colors = [], heat = []) {
      poses = nextPoses;
      poseColors = colors;
      poseHeat = heat;
      if (!poses.length) flames = [];
      draw();
    },
  };
}
