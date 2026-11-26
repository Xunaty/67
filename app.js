import { startCamera } from './camera.js';
import { assignPlayers, closestPoses, comboLevel, COMBO_WINDOW_MS, createGestureCounter } from './gesture.js';
import { createArmOverlay } from './overlay.js';
import { exitCameraFullscreen } from './fullscreen.js';
import * as fx from './effects.js';
import { captureMoment, download, INSTAGRAM, makeCard, pickMoments } from './moments.js';

const SOLO_GOAL = 1000;
const RACE_GOAL = 500;
const TIMED_MS = 30_000;
const IDLE_MS = 4000;
const INSTAGRAM_URL = 'https://www.instagram.com/israelmartinsai/';
const playerColors = ['#e6fa77', '#b69bff'];
const heatLabels = ['', 'ESQUENTANDO', 'PEGANDO FOGO 🔥', 'AURA INFINITA ♾️'];
const hypeLines = ['AURA FARMING', 'SIGMA', 'MOGANDO', 'NO CAP', 'BRAINROT', 'ULTRA AURA', 'GOAT', 'TANKANDO'];
// Thresholds are a share of the goal, or raw points in the 30-second battle.
const titles = [[0, 'NPC'], [0.1, 'Beta'], [0.35, 'Sigma'], [0.7, 'Aura Lord']];
const timedTitles = [[0, 'NPC'], [25, 'Beta'], [60, 'Sigma'], [100, 'Aura Lord']];

const formatter = new Intl.NumberFormat('pt-BR');
const $ = (id) => document.getElementById(id);
const video = $('video');
const overlayCanvas = $('arm-overlay');
const armOverlay = createArmOverlay(overlayCanvas, video);
const viewfinder = $('viewfinder');
const cameraCard = $('camera-card');
const cameraButton = $('camera-toggle');
const victory = $('victory');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let game = 'solo';
let battleType = 'race';
let soloScore = 0;
let battleScores = [0, 0];
let battleResult = null;
let moments = [];
let round = null;
let cameraSession;
let timerFrame;
let names = readJSON('aura-names', ['Jogador 1', 'Jogador 2']);

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

const battle = () => game === 'battle';
const timed = () => battle() && battleType === 'timed';
const nameOf = (player) => (battle() ? names[player]?.trim() || `Jogador ${player + 1}` : 'Você');
const scoreOf = (player) => (battle() ? battleScores[player] : soloScore);
const sideOf = (player) => (battle() ? player + 1 : 0);
const finished = () => (battle() ? battleResult !== null : soloScore >= SOLO_GOAL);

function titleFor(points) {
  const scale = timed() ? timedTitles : titles.map(([share, title]) => [share * (battle() ? RACE_GOAL : SOLO_GOAL), title]);
  return scale.findLast(([minimum]) => points >= minimum)[1];
}

function updateScore() {
  const solo = formatter.format(soloScore);
  $('score').value = solo;
  $('preview-score').textContent = solo;
  $('progress').value = soloScore;
  $('title-solo').textContent = titleFor(soloScore);
  // In the timed battle the leader's bar is full, so the bars show who is ahead.
  const max = timed() ? Math.max(1, ...battleScores) : RACE_GOAL;
  battleScores.forEach((points, player) => {
    const id = player + 1;
    $(`score-p${id}`).value = points;
    $(`preview-p${id}`).textContent = points;
    $(`progress-p${id}`).max = max;
    $(`progress-p${id}`).value = points;
    $(`title-p${id}`).textContent = titleFor(points);
  });
}

function updateNames() {
  names.forEach((name, player) => {
    $(`name-p${player + 1}`).value = name;
    $(`hud-name-${player + 1}`).textContent = nameOf(player);
  });
}

function setStatus(label, tracking = false) {
  $('camera-status').classList.toggle('is-tracking', tracking);
  if ($('status-label').textContent !== label) $('status-label').textContent = label;
}

function animate(element, frames, duration) {
  if (reducedMotion.matches) return;
  element.getAnimations().forEach((running) => running.cancel());
  element.animate(frames, { duration, easing: 'ease-out' });
}

function setSide(element, player) {
  if (battle()) element.dataset.side = String(player + 1);
  else delete element.dataset.side;
}

function hype(player, text) {
  const pop = $('hype-pop');
  pop.textContent = text;
  $('announcer').textContent = text;
  setSide(pop, player);
  animate(pop, [
    { opacity: 0, transform: 'scale(.4) rotate(-12deg)' },
    { opacity: 1, transform: 'scale(1.15) rotate(4deg)', offset: 0.2 },
    { opacity: 1, transform: 'scale(1) rotate(-3deg)', offset: 0.75 },
    { opacity: 0, transform: 'scale(1.3) rotate(0)' },
  ], 1300);
}

function capture(caption) {
  const moment = captureMoment(video, overlayCanvas, caption);
  if (moment) moments.push(moment);
}

function sixSeven(player) {
  const points = scoreOf(player);
  fx.airhorn();
  fx.speak('six seven!', 'en-US');
  $('announcer').textContent = 'Six seven!';
  animate($('six-seven'), [
    { opacity: 0, transform: 'scale(.2) rotate(-25deg)' },
    { opacity: 1, transform: 'scale(1.2) rotate(6deg)', offset: 0.18 },
    { opacity: 1, transform: 'scale(1) rotate(-4deg)', offset: 0.8 },
    { opacity: 0, transform: 'scale(2.2) rotate(0)' },
  ], 1600);
  capture(`${nameOf(player).toUpperCase()} · SIX SEVEN (${points})`);
}

function awardPoint(player, now) {
  if (!round?.armed || finished()) return;
  const before = titleFor(scoreOf(player));
  if (battle()) battleScores[player] += 1;
  else soloScore += 1;
  const heat = round.heat[player];
  heat.times = [...heat.times.filter((time) => now - time < COMBO_WINDOW_MS), now];
  heat.lastPoint = now;
  heat.idleShown = false;
  updateScore();

  const points = scoreOf(player);
  fx.pointSound(heat.level);
  const pop = $('point-pop');
  setSide(pop, player);
  animate(pop, [
    { opacity: 0, transform: 'translateY(14px) scale(.82)' },
    { opacity: 1, transform: 'translateY(0) scale(1.1)', offset: 0.23 },
    { opacity: 0, transform: 'translateY(-38px) scale(1)' },
  ], 465);

  const after = titleFor(points);
  if (points % 100 === 67) sixSeven(player);
  else if (after !== before) {
    fx.levelUpSound(2);
    hype(player, `VIROU ${after.toUpperCase()}`);
  } else if (points % 25 === 0) hype(player, hypeLines[Math.floor(Math.random() * hypeLines.length)]);

  if (!battle() && soloScore >= SOLO_GOAL) {
    capture('VOCÊ · 1.000 DE AURA');
    void celebrate();
  } else if (battle() && battleType === 'race' && points >= RACE_GOAL) finishBattle(player);
}

// Fire levels follow the combo; climbing a level plays a sound and the first big fire gets a photo.
function updateHeat(now) {
  round.heat.forEach((heat, player) => {
    const level = comboLevel(heat.times, now);
    const side = sideOf(player);
    if (level > heat.level) {
      fx.levelUpSound(level);
      if (level >= 2 && !heat.shot[level]) {
        heat.shot[level] = true;
        capture(`${nameOf(player).toUpperCase()} · ${heatLabels[level]}`);
      }
    }
    heat.level = level;
    $(`glow-${side}`).dataset.level = String(level);
    $(`heat-${side}`).textContent = heatLabels[level];
    if (round.armed && round.tracking[player] && heat.lastPoint && !heat.idleShown && now - heat.lastPoint > IDLE_MS) {
      heat.idleShown = true;
      fx.sadTrombone();
      hype(player, '-1000 DE AURA 💀');
    }
  });
  viewfinder.classList.toggle('is-shaking', round.heat.some((heat) => heat.level === 3));
}

function clearEffects() {
  [0, 1, 2].forEach((side) => {
    $(`glow-${side}`).dataset.level = '0';
    $(`heat-${side}`).textContent = '';
  });
  viewfinder.classList.remove('is-shaking');
  $('battle-timer').textContent = '';
  cancelAnimationFrame(timerFrame);
}

function showIdle(error) {
  const won = finished();
  armOverlay.update();
  clearEffects();
  cameraCard.dataset.mode = 'idle';
  setStatus('Desligada');
  $('camera-action').textContent = won ? 'Ver resultado' : 'Ligar câmera';
  const winner = battleResult?.winner;
  $('camera-title').textContent = error ? 'Câmera indisponível'
    : won ? (battle() ? 'Batalha encerrada!' : 'Meta batida!') : (battle() ? 'Pronto pra batalha?' : 'Pronto pra farmar?');
  $('camera-message').textContent = error?.message ?? (won
    ? (battle() ? (winner >= 0 ? `${nameOf(winner)} venceu.` : 'Deu empate.') : 'Você chegou a 1.000 de aura.')
    : (battle() ? 'Fiquem um de cada lado da linha do meio, com os braços no quadro.' : 'Ligue a câmera e enquadre os dois braços.'));
  if (error) $('camera-message').setAttribute('role', 'alert');
  else $('camera-message').removeAttribute('role');
}

function stopCamera(error) {
  cameraSession?.abort();
  cameraSession = undefined;
  round = null;
  showIdle(error);
}

function readRanking() {
  const today = new Date().toDateString();
  return readJSON('aura-ranking', []).filter((entry) => entry.day === today);
}

function renderRanking() {
  const best = readRanking().sort((a, b) => b.points - a.points).slice(0, 5);
  for (const list of [$('guide-ranking'), $('victory-ranking')]) {
    const items = best.map(({ name, points }) => {
      const item = document.createElement('li');
      item.append(Object.assign(document.createElement('span'), { textContent: name }), ` ${points}`);
      return item;
    });
    if (!items.length) items.push(Object.assign(document.createElement('li'), { className: 'empty', textContent: 'Ninguém ainda. Bora?' }));
    list.replaceChildren(...items);
  }
}

function finishBattle(winner) {
  battleResult = { winner };
  capture(winner >= 0 ? `${nameOf(winner).toUpperCase()} VENCEU` : 'EMPATE');
  if (timed()) {
    const day = new Date().toDateString();
    const entries = battleScores.map((points, player) => ({ name: nameOf(player), points, day }));
    localStorage.setItem('aura-ranking', JSON.stringify([...readRanking(), ...entries].slice(-200)));
    renderRanking();
  }
  void celebrate();
}

function tickTimer() {
  if (!round) return;
  const left = Math.max(0, round.endsAt - performance.now());
  const seconds = Math.ceil(left / 1000);
  $('battle-timer').textContent = `0:${String(seconds).padStart(2, '0')}`;
  if (seconds <= 5 && seconds !== round.lastBeep) {
    round.lastBeep = seconds;
    if (seconds > 0) fx.countdownBeep(false);
  }
  if (left > 0) {
    timerFrame = requestAnimationFrame(tickTimer);
    return;
  }
  const [leftScore, rightScore] = battleScores;
  finishBattle(leftScore === rightScore ? -1 : leftScore > rightScore ? 0 : 1);
}

async function runCountdown(signal) {
  const countdown = $('countdown');
  for (const step of ['3', '2', '1', 'SIX SEVEN!']) {
    if (signal.aborted) return;
    const last = step.length > 1;
    countdown.textContent = step;
    fx.countdownBeep(last);
    if (last) {
      fx.airhorn();
      fx.speak('six seven!', 'en-US');
    }
    animate(countdown, [
      { opacity: 0, transform: 'scale(2.4)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.25 },
      { opacity: 1, transform: 'scale(.95)', offset: 0.8 },
      { opacity: 0, transform: 'scale(.7)' },
    ], 850);
    await wait(850);
  }
  if (signal.aborted || !round) return;
  round.armed = true;
  if (timed()) {
    round.endsAt = performance.now() + TIMED_MS;
    tickTimer();
  }
}

function fireConfetti() {
  if (reducedMotion.matches) return;
  const colors = ['#e6fa77', '#ae8cff', '#ff865c', '#66e1d1', '#fcf7ff'];
  $('confetti').replaceChildren(...Array.from({ length: 85 }, (_, index) => {
    const piece = document.createElement('i');
    const angle = index * 2.4;
    const distance = 90 + Math.random() * 460;
    piece.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
    piece.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
    piece.style.setProperty('--rotation', `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty('--duration', `${0.85 + Math.random() * 0.9}s`);
    piece.style.backgroundColor = colors[index % colors.length];
    return piece;
  }));
}

function showHero(url, alt) {
  const hero = $('victory-hero');
  hero.src = url;
  hero.alt = alt;
}

function fillVictory() {
  const [left, right] = battleScores;
  const winner = battleResult?.winner;
  const title = !battle() ? 'Farmou aura!' : winner >= 0 ? `${nameOf(winner)} venceu!` : 'Empate!';
  const text = !battle() ? 'Você chegou a 1.000 de aura.'
    : timed() ? `${left} × ${right} em 30 segundos.` : `Chegou a 500 primeiro. Placar: ${left} × ${right}.`;
  $('victory-title').textContent = title;
  $('victory-text').textContent = text;
  $('victory-ranking-box').hidden = !timed();

  const shown = pickMoments(moments);
  const last = shown.at(-1);
  if (last) showHero(last.url, last.caption);
  else showHero('./assets/tigre-arco-iris.webp', 'Tigre saltando na frente de um arco-íris');
  $('moments').replaceChildren(...shown.map((moment) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Ver momento: ${moment.caption}`);
    button.append(Object.assign(document.createElement('img'), { src: moment.url, alt: '' }));
    button.addEventListener('click', () => showHero(moment.url, moment.caption));
    return button;
  }));
}

async function celebrate() {
  stopCamera();
  await exitCameraFullscreen().catch(() => {});
  fillVictory();
  victory.showModal();
  fireConfetti();
  void fx.victorySound();
}

$('sound').addEventListener('click', () => {
  const enabled = $('sound').getAttribute('aria-pressed') !== 'true';
  $('sound').setAttribute('aria-pressed', String(enabled));
  $('sound-state').textContent = enabled ? 'Ligado' : 'Desligado';
  fx.setSoundEnabled(enabled);
});

cameraButton.addEventListener('click', async () => {
  if (cameraSession) {
    stopCamera();
    return;
  }
  if (finished()) {
    fillVictory();
    victory.showModal();
    return;
  }

  fx.enableAudio();
  const inBattle = battle();
  if (inBattle) {
    battleScores = [0, 0];
    moments = [];
    updateScore();
  }
  const session = new AbortController();
  cameraSession = session;
  const counters = [createGestureCounter(), createGestureCounter()];
  const newHeat = () => ({ times: [], level: 0, lastPoint: 0, idleShown: false, shot: {} });
  round = { armed: !inBattle, heat: [newHeat(), newHeat()], tracking: [false, false], endsAt: 0, lastBeep: null };
  cameraCard.dataset.mode = 'loading';
  setStatus('Iniciando');
  $('camera-title').textContent = 'Preparando a câmera';
  $('camera-message').removeAttribute('role');
  $('camera-message').textContent = 'Se for solicitado, permita o acesso à câmera.';
  $('camera-action').textContent = 'Cancelar';

  try {
    await startCamera(video, {
      // Extra poses let the closest people win over whoever stands in the background.
      numPoses: inBattle ? 4 : 3,
      onFrame(poses) {
        if (!round) return;
        const now = performance.now();
        const players = inBattle ? assignPlayers(poses) : [closestPoses(poses, 1)[0]];
        const results = players.map((landmarks, player) => counters[player].update(landmarks));
        results.forEach((result, player) => {
          if (!round) return; // a winning point ends the round mid-frame
          round.tracking[player] = result.tracking;
          if (result.scored) awardPoint(player, now);
        });
        if (!round) return;
        updateHeat(now);
        armOverlay.update(players, inBattle ? playerColors : [], round.heat.map((heat) => heat.level));
        const seen = results.filter((result) => result.tracking).length;
        const label = !seen ? 'Enquadre os braços'
          : inBattle ? (seen === 2 ? '2 jogadores' : '1 jogador detectado') : 'Braços detectados';
        setStatus(label, seen === players.length);
      },
      onError(error) {
        if (!session.signal.aborted) stopCamera(error);
      },
    }, session.signal);
    if (session.signal.aborted) return;
    cameraCard.dataset.mode = 'live';
    setStatus('Enquadre os braços');
    $('camera-action').textContent = 'Desligar câmera';
    if (inBattle) void runCountdown(session.signal);
  } catch (error) {
    if (!session.signal.aborted) stopCamera(error);
  }
});

function resetBattle() {
  battleScores = [0, 0];
  battleResult = null;
  moments = [];
  updateScore();
}

function pick(groupId, attribute, value) {
  document.querySelectorAll(`#${groupId} button`).forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset[attribute] === value));
  });
}

document.querySelectorAll('#game-mode button').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.game === game) return;
    stopCamera();
    game = button.dataset.game;
    document.documentElement.dataset.game = game;
    pick('game-mode', 'game', game);
    resetBattle();
    updateNames();
    showIdle();
  });
});

document.querySelectorAll('#battle-type button').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.type === battleType) return;
    stopCamera();
    battleType = button.dataset.type;
    document.documentElement.dataset.battle = battleType;
    pick('battle-type', 'type', battleType);
    resetBattle();
    showIdle();
  });
});

[0, 1].forEach((player) => {
  $(`name-p${player + 1}`).addEventListener('input', (event) => {
    names[player] = event.target.value;
    localStorage.setItem('aura-names', JSON.stringify(names));
    $(`hud-name-${player + 1}`).textContent = nameOf(player);
  });
});

$('open-instagram').addEventListener('click', () => {
  if (window.auraDesktop) void window.auraDesktop.openInstagram();
  else window.open(INSTAGRAM_URL, '_blank', 'noopener');
});

$('save-card').addEventListener('click', async () => {
  const hero = $('victory-hero');
  const photo = hero.src.startsWith('data:') ? hero.src : null;
  const subtitle = $('victory-text').textContent;
  const card = await makeCard({ title: $('victory-title').textContent, subtitle, photo });
  download(card, `farmador-de-aura-${Date.now()}.png`);
  $('announcer').textContent = `Card salvo. Marca o ${INSTAGRAM}!`;
});

$('restart').addEventListener('click', () => {
  if (battle()) resetBattle();
  else {
    soloScore = 0;
    moments = [];
    updateScore();
  }
  showIdle();
  victory.close();
  $('confetti').replaceChildren();
  cameraButton.focus();
});

window.addEventListener('pagehide', () => stopCamera(), { capture: true });
updateNames();
updateScore();
renderRanking();
