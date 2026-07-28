// ~~~~~~~~~~~~~~~~~~~~
// EFECTE SONORE!!! fiecare joc rpg ar trebuii să aibă efecte sonore, nu?
// ~~~~~~~~~~~~~~~~~~~~

const SFX_PATH = 'assets/sfx/';

const SOUNDS = {
  click:   'click.mp3',
  nav:     'nav.mp3',
  correct: 'correct.mp3',
  wrong:   'wrong.mp3',
  victory: 'victory.mp3',
  defeat:  'defeat.mp3',
  buy:     'buy.mp3',
  battle:  'battle-start.mp3',
  levelup: 'levelup.mp3',
};

const cache  = {};
let   volume = 0.3;
let   muted  = localStorage.getItem('ct_sfx_muted') === '1';

function baseAudio(name) {
  if (!SOUNDS[name]) return null;
  if (!cache[name]) {
    const a   = new Audio(SFX_PATH + SOUNDS[name]);
    a.preload = 'auto';
    cache[name] = a;
  }
  return cache[name];
}

export function playSfx(name) {
  if (muted) return;
  const base = baseAudio(name);
  if (!base) return;
  try {
    const a  = base.cloneNode();
    a.volume = volume;
    a.play().catch(() => {});
  } catch (_) { }
}

export function setSfxVolume(v) {
  volume = Math.max(0, Math.min(1, v));
}

export function isSfxMuted() { return muted; }

export function toggleSfxMuted() {
  muted = !muted;
  localStorage.setItem('ct_sfx_muted', muted ? '1' : '0');
  return muted;
}

export function initSfxClickSounds() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.hasAttribute('data-no-sfx')) return;
    if (btn.classList.contains('answer-btn')) return;
    if (btn.classList.contains('nav-btn')) return;
    playSfx('click');
  }, true);
}
