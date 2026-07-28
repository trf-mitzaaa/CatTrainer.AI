// ~~~~~~~~~~~~~~~~~~~~
// UI!! nu prea am ce să explic aici. script care se ocupă de interfață
// ~~~~~~~~~~~~~~~~~~~~

import { SUBJECTS, getSubject } from '../game.js';
import { t } from './i18n.js';
import { emojiIcon } from './icons.js';

export function showToast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(el._timer);
  el.classList.remove('show');
  el.textContent = msg;
  void el.offsetHeight;
  el.classList.add('show');
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

export function askConfirm(message, okLabel = 'OK', cancelLabel = 'Anulează') {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay confirm-overlay';
    ov.innerHTML = `
      <div class="confirm-box">
        <p class="confirm-msg"></p>
        <div class="confirm-actions">
          <button class="rpg-panel-btn" type="button" data-c="no"></button>
          <button class="rpg-panel-btn rpg-panel-btn--gold" type="button" data-c="yes"></button>
        </div>
      </div>`;
    ov.querySelector('.confirm-msg').textContent   = message;
    ov.querySelector('[data-c="no"]').textContent  = cancelLabel;
    ov.querySelector('[data-c="yes"]').textContent = okLabel;

    const done = (v) => { document.removeEventListener('keydown', onKey); ov.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    ov.addEventListener('click', (e) => {
      if (e.target === ov) return done(false);       // backdrop = cancel
      const btn = e.target.closest('[data-c]');
      if (btn) done(btn.dataset.c === 'yes');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  });
}

export function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = p.id === pageId ? '' : 'none';
    p.classList.toggle('active', p.id === pageId);
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page && pageId.startsWith(btn.dataset.page));
  });
}

export function showScreen(screenId) {
  ['landingScreen', 'authScreen', 'appScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === screenId ? '' : 'none';
    el.classList.toggle('active', id === screenId);
  });
}

export function updateHUD(userData) {
  if (!userData) return;
  const level     = userData.level || 1;
  const xp        = userData.xp    || 0;
  const xpNeeded  = Math.floor(100 * Math.pow(1.25, level - 1));
  const xpPercent = Math.min((xp / xpNeeded) * 100, 100);

  setText('hudName',   (userData.displayName || 'Erou') + (userData.clanTag ? ` [${userData.clanTag}]` : ''));
  setText('hudLevel',  level);
  setText('hudGold',   userData.gold || 0);
  setText('xpVal',     xp);
  setText('xpNeedVal', xpNeeded);
  setWidth('xpFill',   xpPercent);

  const av = document.getElementById('hudAvatar');
  if (av) {
    const a = userData.avatar || '🐱';
    av.innerHTML = (a.startsWith('data:image') || a.startsWith('http'))
      ? `<img src="${a}" alt="" class="avatar-img">`
      : a;
  }
}

export function renderWorldMap(realmProgress = {}, interests = [], onSelect) {
  const container = document.getElementById('subjectRealms');
  if (!container) return;
  container.innerHTML = '';

  SUBJECTS.forEach(subject => {
    const prog      = realmProgress[subject.key] || {};
    const completed = (prog.completedLevels || []).length;
    const total     = subject.levels.length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allDone   = completed >= total;
    const isFav     = interests.includes(subject.key);

    const card = document.createElement('div');
    card.className   = 'realm-card' + (isFav ? ' realm-card--highlighted' : '');
    card.dataset.subject = subject.key;
    card.style.setProperty('--realm-color', subject.color);

    card.innerHTML = `
      ${isFav ? '<div class="realm-fav-badge">⭐ Preferat</div>' : ''}
      ${allDone ? '<div class="realm-lock" title="Completat!">✅</div>' : ''}
      <span class="realm-icon">${emojiIcon(subject.icon)}</span>
      <div class="realm-name">${(()=>{const k='subject.'+subject.key; const v=t(k); return v===k?subject.name:v;})()}</div>
      <div class="realm-levels">${completed} / ${total} nivele</div>
      <div class="realm-progress-bar">
        <div class="realm-progress-fill" style="width:${pct}%; background:${subject.color};"></div>
      </div>
    `;

    card.addEventListener('click', () => onSelect(subject.key));
    container.appendChild(card);
  });
}

export function renderLevelRoad(subjectKey, completedLevels = [], onSelect) {
  const subject = getSubject(subjectKey);
  const road    = document.getElementById('levelRoad');
  const title   = document.getElementById('levelMapTitle');
  if (!subject || !road) return;

  if (title) title.textContent = `${subject.icon} ${t('subject.' + subjectKey) || subject.name}`;
  const levelPage = document.getElementById('levelmapPage');
  if (levelPage) levelPage.dataset.subject = subjectKey;
  road.innerHTML = '';

  subject.levels.forEach((level, idx) => {
    const isCompleted = completedLevels.includes(idx);
    const isUnlocked  = idx === 0 || completedLevels.includes(idx - 1);
    const isLocked    = !isUnlocked;

    let badgeClass = 'badge-lesson';
    if (level.type === 'enemy') badgeClass = 'badge-enemy';
    if (level.type === 'boss')  badgeClass = 'badge-boss';

    let btnClass = 'level-node-btn';
    if (level.type === 'lesson') btnClass += ' lesson-node';
    if (level.type === 'enemy')  btnClass += ' enemy-node';
    if (level.type === 'boss')   btnClass += ' boss-node';
    if (isCompleted)             btnClass += ' completed';
    if (isLocked)                btnClass += ' locked';

    const nodeIcon  = isCompleted ? '✅' : (isLocked ? '🔒' : level.icon);
    const typeLabel = level.type === 'lesson' ? t('battle.type.lesson')
        : level.type === 'boss'   ? t('battle.type.boss')
            :                           t('battle.type.enemy');

    const node = document.createElement('div');
    node.className = 'level-node';
    node.innerHTML = `
      <button class="${btnClass}" ${isLocked ? 'disabled' : ''} data-level="${idx}">
        ${emojiIcon(nodeIcon)}
      </button>
      <div class="level-node-label">
        <div class="level-node-title">${(()=>{const k='level.'+subjectKey+'.'+idx; const v=t(k); return v===k ? level.title : v;})()}</div>
        <span class="level-type-badge ${badgeClass}">${typeLabel}</span>
      </div>
    `;

    if (!isLocked) {
      node.querySelector('button').addEventListener('click', () => onSelect(idx));
    }
    road.appendChild(node);
  });

}

export function renderRealmProgress(realmProgress = {}) {
  const container = document.getElementById('realmProgress');
  if (!container) return;
  container.innerHTML = '';

  SUBJECTS.forEach(subject => {
    const prog      = realmProgress[subject.key] || {};
    const completed = (prog.completedLevels || []).length;
    const total     = subject.levels.length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'realm-progress-row';
    row.innerHTML = `
      <span class="realm-progress-name">${emojiIcon(subject.icon)} ${(()=>{const k='subject.'+subject.key; const v=t(k); return v===k?subject.name:v;})()}</span>
      <div class="realm-p-bar">
        <div class="realm-p-fill" style="width:${pct}%; background:${subject.color};"></div>
      </div>
      <span class="realm-p-pct">${pct}%</span>
    `;
    container.appendChild(row);
  });
}

export function renderShop(shopItems, userGold, userInventory = [], onBuy) {
  const container = document.getElementById('shopGrid');
  if (!container) return;
  container.innerHTML = '';

  shopItems.forEach(item => {
    const owned     = userInventory.includes(item.id);
    const canAfford = userGold >= item.price;

    const card = document.createElement('div');
    card.className = 'shop-item';
    card.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-desc">${item.desc}</div>
      <div class="shop-item-price">💰 ${item.price}</div>
      <button class="buy-btn" ${owned || !canAfford ? 'disabled' : ''} data-id="${item.id}">
        ${owned ? t('shop.owned') : canAfford ? t('shop.buy') : t('shop.broke')}
      </button>
    `;
    if (!owned && canAfford) {
      card.querySelector('.buy-btn').addEventListener('click', () => onBuy(item));
    }
    container.appendChild(card);
  });
}

export function renderAchievements(allAchievements, earned = []) {
  const container = document.getElementById('achievementsGrid');
  if (!container) return;
  container.innerHTML = '';

  allAchievements.forEach(ach => {
    const isEarned = earned.includes(ach.id);
    const card     = document.createElement('div');
    card.className = `achievement-card${isEarned ? ' earned' : ''}`;
    card.innerHTML = `
      <div class="achievement-icon" style="${isEarned ? '' : 'filter:grayscale(1);opacity:0.4;'}">${emojiIcon(ach.icon)}</div>
      <div class="achievement-name">${ach.name}</div>
      <div class="achievement-desc">${ach.desc}</div>
    `;
    container.appendChild(card);
  });
}

export function updateBattleHP(enemyPct, playerPct) {
  const setHp = (id, pct) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = Math.max(0, pct) + '%';
    // Pokémon-style color thresholds: green → orange → red
    el.classList.toggle('hp--mid', pct <= 50 && pct > 20);
    el.classList.toggle('hp--low', pct <= 20);
  };
  setHp('enemyHpFill',  enemyPct);
  setHp('playerHpFill', playerPct);
}

export function showVictory(title, msg, rewards) {
  setText('victoryTitle', title);
  const msgEl    = document.getElementById('victoryMsg');
  const rewardEl = document.getElementById('rewardBox');
  if (msgEl)    msgEl.textContent  = msg;
  if (rewardEl) rewardEl.innerHTML = rewards;
  const el = document.getElementById('victoryOverlay');
  if (el) el.style.display = 'flex';
}

export function hideVictory() {
  const el = document.getElementById('victoryOverlay');
  if (el) el.style.display = 'none';
}

export function showDefeat(msg) {
  const msgEl = document.getElementById('defeatMsg');
  if (msgEl) msgEl.textContent = msg;
  const el = document.getElementById('defeatOverlay');
  if (el) el.style.display = 'flex';
}

export function hideDefeat() {
  const el = document.getElementById('defeatOverlay');
  if (el) el.style.display = 'none';
}

export function shakeElement(el) {
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = 'enemyShake 0.5s ease';
}

export function typewriterEffect(el, text, speed = 30) {
  if (!el) return;
  if (el._typewriterTimer) {
    clearInterval(el._typewriterTimer);
    el._typewriterTimer = null;
  }
  el.textContent = '';
  let i = 0;
  el._typewriterTimer = setInterval(() => {
    el.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(el._typewriterTimer);
      el._typewriterTimer = null;
    }
  }, speed);
}

export function confettiBurst() {
  const colors = ['#F0C040', '#C0392B', '#7B2D8B', '#F5E6C8', '#4CAF50'];
  for (let i = 0; i < 40; i++) {
    const el              = document.createElement('div');
    el.style.position     = 'fixed';
    el.style.left         = (Math.random() * 100) + 'vw';
    el.style.top          = '-10px';
    el.style.width        = (Math.random() * 10 + 5) + 'px';
    el.style.height       = (Math.random() * 10 + 5) + 'px';
    el.style.background   = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    el.style.zIndex       = '9998';
    el.style.pointerEvents = 'none';
    el.style.animation    = `confetti ${Math.random() * 2 + 1.5}s ease-out ${Math.random() * 0.5}s forwards`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%';
}