import { isVisibleLandmark, wristSide } from './gesture.js';

const arms = [
  { joints: [11, 13, 15], color: '#e6fa77' },
  { joints: [12, 14, 16], color: '#c5a8ff' },
];

export function createArmOverlay(canvas, video) {
  const context = canvas.getContext('2d');
  let landmarks;

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
    if (!landmarks || !width || !height || !videoWidth || !videoHeight) return;

    const scale = Math.min(width / videoWidth, height / videoHeight);
    const imageWidth = videoWidth * scale;
    const imageHeight = videoHeight * scale;
    const left = (width - imageWidth) / 2;
    const top = (height - imageHeight) / 2;
    context.scale(pixelWidth / width, pixelHeight / height);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    for (const { joints, color } of arms) {
      if (!joints.every((joint) => isVisibleLandmark(landmarks[joint]))) continue;
      const points = joints.map((joint) => {
        const { x, y } = landmarks[joint];
        return [left + (1 - x) * imageWidth, top + y * imageHeight];
      });

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
    }
  }

  new ResizeObserver(draw).observe(canvas);

  return {
    update(points) {
      landmarks = points;
      draw();
    },
  };
}
