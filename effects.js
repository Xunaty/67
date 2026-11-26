// Every sound is synthesized here, so the game ships no third-party audio besides the victory voice.
let enabled = true;
let audio;
let output;
let voice;

export function enableAudio() {
  if (!enabled || !window.AudioContext) return;
  if (!audio) {
    audio = new AudioContext();
    output = audio.createGain();
    output.connect(audio.destination);
    voice = fetch('./assets/farmou-aura.mp3')
      .then((response) => response.arrayBuffer())
      .then((buffer) => audio.decodeAudioData(buffer))
      .catch(() => null);
  }
  output.gain.value = 1;
  void audio.resume();
}

export function setSoundEnabled(value) {
  enabled = value;
  if (enabled) enableAudio();
  else {
    if (output) output.gain.value = 0;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}

const ready = () => enabled && audio?.state === 'running';

function note(pitch, { delay = 0, duration = 0.12, volume = 0.05, type = 'triangle', slideTo, vibrato } = {}) {
  if (!ready()) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(pitch, start);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  if (vibrato) {
    const wobble = audio.createOscillator();
    const depth = audio.createGain();
    wobble.frequency.value = vibrato;
    depth.gain.value = pitch * 0.03;
    wobble.connect(depth).connect(oscillator.frequency);
    wobble.start(start);
    wobble.stop(start + duration);
  }
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function noise(duration, volume, delay = 0) {
  if (!ready()) return;
  const start = audio.currentTime + delay;
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, start);
  filter.frequency.exponentialRampToValueAtTime(80, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter).connect(gain).connect(output);
  source.start(start);
}

export function speak(text, lang = 'pt-BR') {
  if (!enabled || !('speechSynthesis' in window)) return;
  const line = new SpeechSynthesisUtterance(text);
  line.lang = lang;
  line.rate = 1.15;
  line.pitch = 1.3;
  speechSynthesis.cancel();
  speechSynthesis.speak(line);
}

// The point blip climbs four semitones per fire level, so a combo sounds faster.
export function pointSound(level) {
  note(620 * 2 ** ((level * 4 + Math.random()) / 12), { duration: 0.1, volume: 0.05 });
}

export function levelUpSound(level) {
  note(260, { duration: 0.32, volume: 0.06, type: 'sawtooth', slideTo: 900 + level * 300 });
  if (level === 3) noise(0.7, 0.35, 0.05);
}

export function airhorn() {
  [0, 0.22, 0.4].forEach((delay, index) => {
    const duration = index === 2 ? 0.55 : 0.16;
    [466, 470, 932].forEach((pitch) => note(pitch, { delay, duration, volume: 0.05, type: 'sawtooth' }));
  });
}

export function countdownBeep(final) {
  note(final ? 1320 : 660, { duration: final ? 0.3 : 0.14, volume: 0.08, type: 'square' });
}

export function sadTrombone() {
  [392, 370, 349].forEach((pitch, index) => note(pitch, { delay: index * 0.28, duration: 0.26, volume: 0.06 }));
  note(330, { delay: 0.84, duration: 0.8, volume: 0.06, vibrato: 6 });
}

export async function victorySound() {
  [523, 659, 784, 1047].forEach((pitch, index) => note(pitch, { delay: index * 0.065, duration: 0.2, volume: 0.11 }));
  const recording = await voice;
  if (!ready()) return;
  if (recording) {
    const player = audio.createBufferSource();
    player.buffer = recording;
    player.connect(output);
    player.start(audio.currentTime + 0.25);
  } else speak('Farmou aura!');
}
