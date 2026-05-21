// js/main.js
// ─────────────────────────────────────────────────────────────────────────────
//  CatTrainer RPG — App entry point.
//  Wires together: auth → onboarding → game state → UI → battle.
//  No game logic lives here — navigation and event binding only.
// ─────────────────────────────────────────────────────────────────────────────

import { listenAuth, googleSignIn, emailRegister, emailLogin, logout } from './auth.js';
import { showOnboarding, setPlayerProfile, getPlayerProfile }          from './onboarding.js';
import { loadUserData, completeLevel, buyItem, grantAchievement, registerProfileSetter } from './db.js';
import { SUBJECTS, getShopItems, getAchievements, getLevel, getReward, getHeroClass, getHeroBadge } from './game.js';
import { getShopItemsFromPowerups } from './powerups.js';
import { generateLesson, BattleManager }                               from './battle.js';
import { renderSettings }                                              from './settings.js';
import { applyLanguage, t }                                            from './i18n.js';
import {
  showToast, showPage, showScreen, updateHUD,
  renderWorldMap, renderLevelRoad, renderRealmProgress,
  renderShop, renderAchievements,
  showVictory, hideVictory, showDefeat, hideDefeat,
  updateBattleHP, shakeElement, typewriterEffect,
  confettiBurst, spawnPawPrints, spawnParticles,
} from './ui.js';

// ── Bridge db.js → onboarding.js without a circular import ───────────────────
// When a returning user logs in, loadUserData() calls this to restore their
// profile into onboarding's in-memory cache so battle.js reads it immediately.
registerProfileSetter(setPlayerProfile);

// ── App state ─────────────────────────────────────────────────────────────────
let currentUser      = null;
let userData         = null;
let activeSubjectKey = null;
let activeLevelIdx   = null;
let battleManager    = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
spawnPawPrints();
spawnParticles();
bindAuthButtons();
bindNavButtons();
bindBattleButtons();
bindOverlayButtons();

listenAuth(
    async (user) => {
      currentUser = user;
      userData    = await loadUserData(user.uid);

      if (user._isNewUser) {
        // First-ever login — show onboarding wizard before entering the app
        user._isNewUser = false;
        showOnboarding(user.uid, (profile) => {
          setPlayerProfile(profile);
          userData._profile = profile;
          applyLanguage(profile.language || 'ro');
          enterApp(user);
        });
      } else {
        // Restore saved language for returning users
        const lang = userData?.profile?.language || 'ro';
        applyLanguage(lang);
        enterApp(user);
      }
    },
    () => {
      currentUser = null;
      userData    = null;
      showScreen('authScreen');
    }
);

// ── Enter app ─────────────────────────────────────────────────────────────────
function enterApp(user) {
  showScreen('appScreen');
  refreshHUD();
  navigateTo('worldmapPage');
  showToast(t('toast.welcome', { name: user.displayName || t('hud.default') }));
}

// ── Auth button bindings ──────────────────────────────────────────────────────
function bindAuthButtons() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('loginTab').style.display    = tab === 'login'    ? '' : 'none';
      document.getElementById('registerTab').style.display = tab === 'register' ? '' : 'none';
    });
  });

  document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    try { await googleSignIn(); } catch (_) {}
  });

  document.getElementById('emailLoginBtn')?.addEventListener('click', async () => {
    const email    = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) return showToast(t('toast.fields'));
    try { await emailLogin(email, password); } catch (_) {}
  });

  document.getElementById('emailRegisterBtn')?.addEventListener('click', async () => {
    const name     = document.getElementById('regName')?.value.trim();
    const email    = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    if (!name || !email || !password) return showToast(t('toast.fields'));
    try { await emailRegister(name, email, password); } catch (_) {}
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await logout();
  });
}

// ── Nav button bindings ───────────────────────────────────────────────────────
function bindNavButtons() {
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page + 'Page'));
  });

  document.getElementById('accountBtn')?.addEventListener('click', () => navigateTo('accountPage'));

  document.getElementById('backToRealms')?.addEventListener('click', () => navigateTo('worldmapPage'));

  document.getElementById('backToLevelMap')?.addEventListener('click', () => {
    if (activeSubjectKey) openLevelMap(activeSubjectKey);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigateTo(pageId) {
  showPage(pageId);

  if (pageId === 'worldmapPage') {
    const interests = getPlayerProfile()?.interests || [];
    renderWorldMap(userData?.realmProgress || {}, interests, openLevelMap);
  }
  if (pageId === 'accountPage')  populateAccountPage();
  if (pageId === 'shopPage')     renderShop(getShopItemsFromPowerups(), userData?.gold || 0, userData?.inventory || [], handleBuy);
}

// ── World Map → Level Map ─────────────────────────────────────────────────────
function openLevelMap(subjectKey) {
  activeSubjectKey = subjectKey;
  const prog       = userData?.realmProgress?.[subjectKey] || {};
  const completed  = prog.completedLevels || [];

  renderLevelRoad(subjectKey, completed, (levelIdx) => {
    activeLevelIdx = levelIdx;
    startLevel(subjectKey, levelIdx);
  });

  showPage('levelmapPage');
}

// ── Start a level ─────────────────────────────────────────────────────────────
async function startLevel(subjectKey, levelIdx) {
  const level = getLevel(subjectKey, levelIdx);
  if (!level) return;

  showPage('battlePage');
  resetBattleUI();

  document.getElementById('enemyName').textContent        = level.enemy || level.title;
  document.getElementById('playerNameBattle').textContent = userData?.displayName || 'Erou';

  setDialogue(t(level.type === 'boss' ? 'gm.boss_warn' : level.type === 'lesson' ? 'gm.lesson' : 'gm.battle'));

  document.getElementById('startLessonBtn').style.display = '';
  document.getElementById('startBattleBtn').style.display = level.type !== 'lesson' ? '' : 'none';
  document.getElementById('continueBtn').style.display    = 'none';
}

// ── Battle button bindings ────────────────────────────────────────────────────
function bindBattleButtons() {
  // Study Lesson
  document.getElementById('startLessonBtn')?.addEventListener('click', async () => {
    const level = getLevel(activeSubjectKey, activeLevelIdx);
    if (!level) return;

    setBattleActions('loading');
    setDialogue(t('battle.lesson.loading'));

    try {
      const text = await generateLesson(level.topic);
      document.getElementById('lessonContent').style.display = '';
      document.getElementById('dialogueBox').style.display   = 'none';
      document.getElementById('questionArea').style.display  = 'none';
      document.getElementById('lessonText').innerHTML        = text.replace(/\n/g, '<br>');
      setBattleActions(level.type === 'lesson' ? 'continue' : 'fight');
    } catch {
      setDialogue(t('battle.lesson.error'));
      setBattleActions('idle');
    }
  });

  // Start Battle
  document.getElementById('startBattleBtn')?.addEventListener('click', async () => {
    const level = getLevel(activeSubjectKey, activeLevelIdx);
    if (!level) return;

    setBattleActions('loading');
    document.getElementById('lessonContent').style.display = 'none';
    document.getElementById('dialogueBox').style.display   = '';
    setDialogue(t('battle.fight.loading'));

    battleManager = new BattleManager({
      subject:    activeSubjectKey,
      level,
      onDialogue: setDialogue,
      onUpdateHP: ({ enemyHP, enemyMax, playerHP, playerMax }) => {
        updateBattleHP((enemyHP / enemyMax) * 100, (playerHP / playerMax) * 100);
        document.getElementById('enemyHpText').textContent  = `${enemyHP}/${enemyMax}`;
        document.getElementById('playerHpText').textContent = `${playerHP}/${playerMax}`;
      },
      onVictory: () => { handleVictory(); },
      onDefeat:  () => { handleDefeat(); },
    });

    try {
      await battleManager.loadQuestions();
      showNextQuestion();
    } catch {
      setDialogue(t('battle.question.error'));
      setBattleActions('idle');
    }
  });

  // Continue (lesson-only) — save progress then show victory overlay
  document.getElementById('continueBtn')?.addEventListener('click', async () => {
    await handleVictory();
  });

  // Answer buttons (delegated)
  document.getElementById('answersGrid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.answer-btn');
    if (!btn || !battleManager) return;

    document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);

    const idx    = parseInt(btn.dataset.index, 10);
    const result = battleManager.answerQuestion(idx);
    if (!result) return;

    document.querySelectorAll('.answer-btn').forEach((b, i) => {
      if (i === result.correct)              b.classList.add('correct');
      else if (i === idx && !result.isCorrect) b.classList.add('wrong');
    });

    if (result.isCorrect) {
      shakeElement(document.getElementById('enemySprite'));
    } else {
      shakeElement(document.getElementById('playerSprite'));
    }

    await sleep(1200);

    if (result.gameOver) {
      result.won ? handleVictory() : handleDefeat();
      return;
    }

    battleManager.hasMoreQuestions() ? showNextQuestion() : battleManager.resolveOutcome();
  });
}

// ── Question display ──────────────────────────────────────────────────────────
function showNextQuestion() {
  const q = battleManager?.currentQuestion();
  if (!q) return;

  document.getElementById('lessonContent').style.display = 'none';
  document.getElementById('dialogueBox').style.display   = 'none';
  document.getElementById('questionArea').style.display  = '';
  setBattleActions('none');

  document.getElementById('questionText').textContent = q.question;

  const grid = document.getElementById('answersGrid');
  grid.innerHTML = '';
  q.answers.forEach((ans, i) => {
    const btn         = document.createElement('button');
    btn.className     = 'answer-btn';
    btn.dataset.index = i;
    btn.textContent   = ans;
    grid.appendChild(btn);
  });
}

// ── Victory / Defeat ──────────────────────────────────────────────────────────
async function handleVictory() {
  confettiBurst();
  const level  = getLevel(activeSubjectKey, activeLevelIdx);
  const reward = getReward(level?.type || 'enemy');
  const acc    = battleManager ? battleManager.getAccuracy() : 100;

  await finishLevel(activeSubjectKey, activeLevelIdx, reward.xp, reward.gold);

  showVictory(
      t('victory.title'),
      t('victory.msg', { acc, xp: reward.xp, gold: reward.gold }),
      `<span>+${reward.xp} ✨ XP</span>  <span>+${reward.gold} 💰</span>`
  );
}

function handleDefeat() {
  showDefeat(t('defeat.battle.msg'));
}

// ── Overlay button bindings ───────────────────────────────────────────────────
function bindOverlayButtons() {
  document.getElementById('victoryOkBtn')?.addEventListener('click', () => {
    hideVictory();
    openLevelMap(activeSubjectKey);
  });

  document.getElementById('defeatRetryBtn')?.addEventListener('click', () => {
    hideDefeat();
    startLevel(activeSubjectKey, activeLevelIdx);
  });

  document.getElementById('defeatRetreatBtn')?.addEventListener('click', () => {
    hideDefeat();
    openLevelMap(activeSubjectKey);
  });
}

// ── Finish level → save to DB ─────────────────────────────────────────────────
async function finishLevel(subjectKey, levelIdx, xp, gold) {
  if (!currentUser) return;
  const level    = getLevel(subjectKey, levelIdx);
  const reward   = getReward(level?.type || 'lesson');
  const xpGain   = xp   ?? reward.xp;
  const goldGain = gold ?? reward.gold;

  try {
    const result = await completeLevel(currentUser.uid, subjectKey, levelIdx, xpGain, goldGain);
    userData.xp            = result.newXp;
    userData.gold          = result.newGold;
    userData.level         = result.newLevel;
    userData.realmProgress = result.progress;
    refreshHUD();
    checkAchievements();
  } catch (err) {
    console.error('[finishLevel]', err);
  }
}

// ── Shop ──────────────────────────────────────────────────────────────────────
async function handleBuy(item) {
  if (!currentUser || !userData) return;
  const success = await buyItem(currentUser.uid, item, userData.gold);
  if (success) {
    userData.gold     -= item.price;
    userData.inventory = [...(userData.inventory || []), item.id];
    refreshHUD();
    renderShop(getShopItemsFromPowerups(), userData.gold, userData.inventory, handleBuy);
    showToast(t('toast.shop.bought', { name: item.name }));
  } else {
    showToast(t('toast.shop.broke'));
  }
}

// ── Account page ──────────────────────────────────────────────────────────────
function populateAccountPage() {
  if (!userData) return;
  const level = userData.level || 1;

  setText('accAvatar',  '🐱');
  setText('accName',    userData.displayName || 'Erou');
  setText('accClass',   getHeroClass(level));
  setText('accBadge',   getHeroBadge(level));
  setText('accLevel',   level);
  setText('accXP',      userData.xp || 0);
  setText('accGold',    userData.gold || 0);
  setText('accBattles', userData.battlesWon || 0);
  setText('accLessons', userData.lessonsCompleted || 0);
  setText('accStreak',  userData.streak || 0);

  renderRealmProgress(userData.realmProgress || {});
  renderAchievements(getAchievements(), userData.achievements || []);
  renderSettings(userData);

  // Sub-tab switching — re-bind each visit (innerHTML may have been replaced)
  document.querySelectorAll('.account-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.account-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.acc-tab-content').forEach(t => t.style.display = 'none');
      const target = document.getElementById('accTab' + capitalise(btn.dataset.accTab));
      if (target) target.style.display = '';
    });
  });

  // Listen for progress reset from settings.js
  window.addEventListener('userDataReset', async () => {
    userData = await loadUserData(currentUser.uid);
    refreshHUD();
    populateAccountPage();
  }, { once: true });
}

// ── Achievement checks ────────────────────────────────────────────────────────
async function checkAchievements() {
  if (!currentUser || !userData) return;

  const ACHIEVEMENTS = getAchievements(); // must be declared before use

  const grant = async (id) => {
    const earned = await grantAchievement(currentUser.uid, id);
    if (earned) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) showToast(t('toast.achievement', { name: ach.name }));
      userData.achievements = [...(userData.achievements || []), id];
    }
  };

  if ((userData.lessonsCompleted || 0) >= 1) await grant('first_lesson');
  for (const subject of SUBJECTS) {
    const prog      = userData.realmProgress?.[subject.key] || {};
    const completed = prog.completedLevels || [];
    const bossIdx   = subject.levels.findIndex(l => l.type === 'boss');
    if (bossIdx !== -1 && completed.includes(bossIdx)) await grant('first_boss');
    if (completed.length >= subject.levels.length)     await grant('realm_done');
  }

  const allDone = SUBJECTS.every(s => {
    const c = userData.realmProgress?.[s.key]?.completedLevels || [];
    return c.length >= s.levels.length;
  });
  if (allDone) await grant('all_realms');
}

// ── HUD refresh ───────────────────────────────────────────────────────────────
function refreshHUD() { updateHUD(userData); }

// ── Battle UI helpers ─────────────────────────────────────────────────────────
function resetBattleUI() {
  document.getElementById('lessonContent').style.display = 'none';
  document.getElementById('questionArea').style.display  = 'none';
  document.getElementById('dialogueBox').style.display   = '';
  document.getElementById('enemyHpFill').style.width     = '100%';
  document.getElementById('playerHpFill').style.width    = '100%';
  document.getElementById('enemyHpText').textContent     = '100/100';
  document.getElementById('playerHpText').textContent    = '100/100';
  setBattleActions('idle');
  battleManager = null;
}

function setDialogue(text) {
  const el = document.getElementById('dialogueText');
  if (el) typewriterEffect(el, text, 25);
}

// Modes: 'idle' | 'fight' | 'continue' | 'loading' | 'none'
function setBattleActions(mode) {
  const lessonBtn   = document.getElementById('startLessonBtn');
  const battleBtn   = document.getElementById('startBattleBtn');
  const continueBtn = document.getElementById('continueBtn');
  if (!lessonBtn || !battleBtn || !continueBtn) return;

  lessonBtn.style.display   = (mode === 'idle' || mode === 'loading') ? '' : 'none';
  battleBtn.style.display   = mode === 'fight'   ? '' : 'none';
  continueBtn.style.display = mode === 'continue' ? '' : 'none';

  if (mode === 'loading') {
    lessonBtn.disabled    = true;
    lessonBtn.textContent = t('battle.loading');
  } else {
    lessonBtn.disabled    = false;
    lessonBtn.textContent = t('battle.study');
  }
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}