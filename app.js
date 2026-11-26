import { startCamera } from './camera.js';
import { createGestureCounter } from './gesture.js';
import { createArmOverlay } from './overlay.js';
import { exitCameraFullscreen } from './fullscreen.js';

const goal = 1000;
const formatter = new Intl.NumberFormat('pt-BR');
const $ = (id) => document.getElementById(id);
const video = $('video');
const armOverlay = createArmOverlay($('arm-overlay'), video);
const cameraCard = $('camera-card');
const cameraButton = $('camera-toggle');
const scoreOutput = $('score');
const victory = $('victory');
const soundButton = $('sound');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let score = 0;
let cameraSession;
let pointAnimation;
let soundEnabled = true;
let audio;
let voice;
let audioOutput;

function enableAudio() {
  if (!soundEnabled || !window.AudioContext) return;
  if (!audio) {
    audio = new AudioContext();
    audioOutput = audio.createGain();
    audioOutput.connect(audio.destination);
    voice = fetch('./assets/farmou-aura.mp3')
      .then((response) => response.arrayBuffer())
      .then((buffer) => audio.decodeAudioData(buffer))
      .catch(() => null);
  }
  audioOutput.gain.value = 1;
  void audio.resume();
}

function tone(pitch, delay, duration, volume) {
  if (!soundEnabled || !audio || audio.state !== 'running') return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.value = pitch;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audioOutput);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

async function playVictory() {
  if (!soundEnabled || !audio) return;
  [523, 659, 784, 1047].forEach((pitch, index) => tone(pitch, index * 0.065, 0.2, 0.11));
  const recording = await voice;
  if (!soundEnabled || !victory.open) return;
  if (recording) {
    const player = audio.createBufferSource();
    player.buffer = recording;
    player.connect(audioOutput);
    player.start(audio.currentTime + 0.25);
  } else if ('speechSynthesis' in window) {
    const line = new SpeechSynthesisUtterance('Farmou aura!');
    line.lang = 'pt-BR';
    speechSynthesis.speak(line);
  }
}

soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  $('sound-state').textContent = soundEnabled ? 'Ligado' : 'Desligado';
  if (soundEnabled) enableAudio();
  else if (audioOutput) audioOutput.gain.value = 0;
});

function updateScore() {
  const value = formatter.format(score);
  scoreOutput.value = value;
  $('preview-score').textContent = value;
  $('progress').value = score;
}

function setStatus(label, tracking = false) {
  $('camera-status').classList.toggle('is-tracking', tracking);
  if ($('status-label').textContent !== label) $('status-label').textContent = label;
}

function showIdle(error) {
  const won = score >= goal;
  armOverlay.update(null);
  cameraCard.dataset.mode = 'idle';
  setStatus('Desligada');
  $('camera-action').textContent = won ? 'Ver vitória' : 'Ligar câmera';
  $('camera-title').textContent = error ? 'Câmera indisponível' : won ? 'Meta batida!' : 'Pronto pra farmar?';
  $('camera-message').textContent = error?.message ?? (won ? 'Você chegou a 1.000 de aura.' : 'Ligue a câmera e enquadre os dois braços.');
  if (error) $('camera-message').setAttribute('role', 'alert');
  else $('camera-message').removeAttribute('role');
}

function stopCamera(error) {
  cameraSession?.abort();
  cameraSession = undefined;
  showIdle(error);
}

async function celebrate() {
  stopCamera();
  await exitCameraFullscreen().catch(() => {});
  victory.showModal();
  const confetti = $('confetti');
  if (!reducedMotion.matches) {
    const colors = ['#e6fa77', '#ae8cff', '#ff865c', '#66e1d1', '#fcf7ff'];
    const pieces = Array.from({ length: 85 }, (_, index) => {
      const piece = document.createElement('i');
      const angle = index * 2.4;
      const distance = 90 + Math.random() * 460;
      piece.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
      piece.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
      piece.style.setProperty('--rotation', `${Math.random() * 900 - 450}deg`);
      piece.style.setProperty('--duration', `${0.85 + Math.random() * 0.9}s`);
      piece.style.backgroundColor = colors[index % colors.length];
      return piece;
    });
    confetti.replaceChildren(...pieces);
  }
  void playVictory();
}

function awardPoint() {
  if (score >= goal) return;
  score += 1;
  updateScore();
  if (score === goal) {
    void celebrate();
    return;
  }

  tone(720, 0, 0.11, 0.047);
  if (reducedMotion.matches) return;
  pointAnimation?.cancel();
  pointAnimation = $('point-pop').animate([
    { opacity: 0, transform: 'translateY(14px) scale(.82)' },
    { opacity: 1, transform: 'translateY(0) scale(1.1)', offset: 0.23 },
    { opacity: 0, transform: 'translateY(-38px) scale(1)' },
  ], { duration: 465, easing: 'ease-out' });
}

cameraButton.addEventListener('click', async () => {
  if (cameraSession) {
    stopCamera();
    return;
  }
  if (score >= goal) {
    victory.showModal();
    return;
  }

  enableAudio();
  const session = new AbortController();
  cameraSession = session;
  const gesture = createGestureCounter();
  cameraCard.dataset.mode = 'loading';
  setStatus('Iniciando');
  $('camera-title').textContent = 'Preparando a câmera';
  $('camera-message').removeAttribute('role');
  $('camera-message').textContent = 'Se for solicitado, permita o acesso à câmera.';
  $('camera-action').textContent = 'Cancelar';

  try {
    await startCamera(video, {
      onFrame(landmarks, time) {
        const { scored, tracking } = gesture.update(landmarks, time);
        armOverlay.update(landmarks);
        setStatus(tracking ? 'Braços detectados' : 'Enquadre os braços', tracking);
        if (scored) awardPoint();
      },
      onError(error) {
        if (!session.signal.aborted) stopCamera(error);
      },
    }, session.signal);
    if (session.signal.aborted) return;
    cameraCard.dataset.mode = 'live';
    setStatus('Enquadre os braços');
    $('camera-action').textContent = 'Desligar câmera';
  } catch (error) {
    if (!session.signal.aborted) stopCamera(error);
  }
});

$('restart').addEventListener('click', () => {
  score = 0;
  updateScore();
  showIdle();
  victory.close();
  $('confetti').replaceChildren();
  cameraButton.focus();
});

window.addEventListener('pagehide', () => stopCamera(), { capture: true });
