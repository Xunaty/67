const viewfinder = document.getElementById('viewfinder');
const button = document.getElementById('fullscreen-toggle');

function setExpanded(expanded) {
  viewfinder.classList.toggle('is-expanded', expanded);
  document.documentElement.classList.toggle('camera-expanded', expanded);
  const label = expanded ? 'Sair da tela cheia' : 'Tela cheia';
  button.dataset.fullscreen = String(expanded);
  button.setAttribute('aria-label', label);
  button.title = label;
}

export async function exitCameraFullscreen() {
  const expanded = viewfinder.classList.contains('is-expanded');
  setExpanded(false);
  if (expanded && window.auraDesktop) await window.auraDesktop.setCameraFullscreen(false);
  else if (document.fullscreenElement === viewfinder) await document.exitFullscreen();
}

button.addEventListener('click', () => {
  if (viewfinder.classList.contains('is-expanded')) {
    void exitCameraFullscreen().catch(() => setExpanded(true));
    return;
  }
  setExpanded(true);
  if (window.auraDesktop) {
    void window.auraDesktop.setCameraFullscreen(true).catch(() => {});
  } else if (document.fullscreenEnabled) {
    void viewfinder.requestFullscreen().catch(() => {});
  }
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) setExpanded(false);
  else if (document.fullscreenElement === viewfinder && !viewfinder.classList.contains('is-expanded')) {
    void document.exitFullscreen().catch(() => setExpanded(true));
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && viewfinder.classList.contains('is-expanded') && !document.fullscreenElement) {
    void exitCameraFullscreen();
  }
});
