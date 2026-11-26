export const INSTAGRAM = '@IsraelMartinsAI';
const MAX_WIDTH = 960;

function heading(context, size) {
  context.font = `800 ${size}px 'Barlow Condensed', 'Arial Narrow', Impact, sans-serif`;
}

function badge(context, text, x, y, size, color) {
  heading(context, size);
  const width = context.measureText(text).width + size * 0.6;
  context.fillStyle = '#171322e6';
  context.beginPath();
  context.roundRect(x, y, width, size * 1.25, size * 0.25);
  context.fill();
  context.fillStyle = color;
  context.fillText(text, x + size * 0.3, y + size * 1.02);
}

// Shoots the mirrored camera image with the arm and fire overlay on top, plus a caption and the Instagram tag.
export function captureMoment(video, overlay, caption) {
  if (!video.videoWidth || !overlay.width) return null;
  const scale = Math.min(1, MAX_WIDTH / overlay.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(overlay.width * scale);
  canvas.height = Math.round(overlay.height * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#100e18';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const fit = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  const width = video.videoWidth * fit;
  const height = video.videoHeight * fit;
  context.save();
  context.translate((canvas.width + width) / 2, (canvas.height - height) / 2);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, width, height);
  context.restore();
  context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  const size = Math.round(canvas.height / 14);
  badge(context, caption, size * 0.6, size * 0.6, size, '#e6fa77');
  badge(context, INSTAGRAM, size * 0.6, canvas.height - size * 2, size * 0.7, '#fcf7ff');
  return { url: canvas.toDataURL('image/jpeg', 0.85), caption };
}

// Keeps the final shot and spreads the rest evenly across the round.
export function pickMoments(moments, count = 8) {
  if (moments.length <= count) return moments;
  const last = moments.at(-1);
  const rest = moments.slice(0, -1);
  const picked = Array.from({ length: count - 1 }, (_, index) =>
    rest[Math.round((index * (rest.length - 1)) / (count - 2))]);
  return [...picked, last];
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

// A 4:5 card for stories and feed: title, photo, result and the Instagram tag.
export async function makeCard({ title, subtitle, photo }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, '#3b2760');
  background.addColorStop(1, '#13111e');
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1350);
  context.textAlign = 'center';
  heading(context, 120);
  context.fillStyle = '#e6fa77';
  context.fillText(title.toUpperCase(), 540, 170, 980);
  context.font = "700 46px 'DM Sans', system-ui, sans-serif";
  context.fillStyle = '#f6f2ff';
  context.fillText(subtitle, 540, 245, 980);
  if (photo) {
    const image = await loadImage(photo);
    const fit = Math.min(980 / image.width, 820 / image.height);
    const width = image.width * fit;
    const height = image.height * fit;
    const y = 300 + (840 - height) / 2;
    context.save();
    context.beginPath();
    context.roundRect(540 - width / 2, y, width, height, 28);
    context.clip();
    context.drawImage(image, 540 - width / 2, y, width, height);
    context.restore();
  }
  heading(context, 64);
  context.fillStyle = '#b69bff';
  context.fillText(`Segue lá → ${INSTAGRAM}`, 540, 1225, 980);
  context.font = "600 34px 'DM Sans', system-ui, sans-serif";
  context.fillStyle = '#b9aecb';
  context.fillText('Farmador de Aura', 540, 1290);
  return canvas.toDataURL('image/png');
}

export function download(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}
