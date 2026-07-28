// js/main.js
// ─────────────────────────────────────────────────────────────────────────────
//  CatTrainer RPG — App entry point.
//  Wires together: auth → onboarding → game state → UI → battle.
//  No game logic lives here — navigation and event binding only.
// ─────────────────────────────────────────────────────────────────────────────

import { listenAuth, googleSignIn, emailRegister, emailLogin, logout, changeDisplayName } from './core/auth.js';
import { showOnboarding, setPlayerProfile, getPlayerProfile }          from './ui/onboarding.js';
import { loadUserData, completeLevel, grantAchievement, saveUserData, registerProfileSetter } from './core/db.js';
import { SUBJECTS, getAchievements, getLevel, getReward, getHeroClass, getHeroBadge, getNextLevelIndex, xpForLevel } from './game.js';
import { generateLesson, BattleManager }                               from './systems/battle.js';
import { renderSettings }                                              from './ui/settings.js';
import { POWERUPS, POWERUP_MAP, SHOP_CATEGORIES, ACTIVE_CONSUMABLES, PERSISTENT_ITEMS,
         PASSIVE_CONSUMABLES, getShopItemsFromPowerups }               from './systems/powerups.js';
import { EQUIPMENT_MAP, MAX_EQUIPPED, RARITY_META, getEquipmentBonuses } from './systems/equipment.js';
import { loadLootConfig, getLootConfig, rollChestDrop, openChestRoll, CHEST_META } from './systems/loot.js';
import { loadGameConfig }                                              from './systems/gameconfig.js';
import { getClanById, createClan, joinClan, leaveClan,
         listClans, joinClanById, buyClanBuff,
         sendClanMessage, listenClanMessages, deleteClanMessage,
         contributeClanXp, contributeClanMissions }                    from './systems/clans.js';
import { getDailyMissions, todayKey, ensurePlayerMissionState,
         ensureClanClaimState }                                        from './systems/missions.js';
import { playSfx, initSfxClickSounds, toggleSfxMuted, isSfxMuted }     from './ui/sfx.js';
import { applyLanguage, t }                                            from './ui/i18n.js';
import './ui/i18n-app.js';   // registers feature translations (side effect)
import { iconHTML, emojiIcon, initIconFallbacks }                      from './ui/icons.js';
import {
  showToast, askConfirm, showPage, showScreen, updateHUD,
  renderWorldMap, renderLevelRoad, renderRealmProgress,
  renderAchievements,
  showVictory, hideVictory, showDefeat, hideDefeat,
  updateBattleHP, shakeElement, typewriterEffect,
  confettiBurst,
} from './ui/ui.js';

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
initSfxClickSounds();
initIconFallbacks();
bindSfxToggle();
bindAdminGesture();
bindLandingButtons();
bindAuthButtons();
bindNavButtons();
bindBattleButtons();
bindOverlayButtons();

listenAuth(
    async (user) => {
      currentUser = user;
      userData    = await loadUserData(user.uid);
      await loadGameConfig().catch(() => {});   // admin HP values + custom stages

      // Load clan info: buff cache + tag backfill
      if (userData?.clanId) {
        try {
          const clan = await getClanById(userData.clanId);
          if (clan) {
            _clanBuffs = clan.buffs || {};
            if (!userData.clanTag) {
              userData.clanTag = clan.tag;
              await saveUserData(user.uid, { clanTag: clan.tag });
            }
          }
        } catch (_) {}
      }

      // Set by auth.js BEFORE Firebase fires the auth event
      const isNew         = window.__catNewUser === true;
      window.__catNewUser = false;

      if (isNew) {
        // Switch screens first so the onboarding overlay is visible
        showScreen('appScreen');
        showOnboarding(user.uid, (profile) => {
          setPlayerProfile(profile);
          if (!userData) userData = {};
          userData.profile = profile;
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
      showScreen('landingScreen');
    }
);

// ── Enter app ─────────────────────────────────────────────────────────────────
function enterApp(user) {
  showScreen('appScreen');
  refreshHUD();
  loadLootConfig().catch(() => {});   // admin overrides for chest drops
  navigateTo('homePage');
  showToast(t('toast.welcome', { name: user.displayName || t('hud.default') }));
}

// ── Hidden admin access ───────────────────────────────────────────────────────
// 5 quick clicks on the cat logo on the login screen reveal the admin link.
// This is only an entry point — real access control is the UID gate on
// admin.html plus Firestore security rules on config/*.
function bindAdminGesture() {
  let clicks = 0;
  let timer  = null;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#authScreen .cat-logo')) return;
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 2500);
    if (clicks >= 5) {
      clicks = 0;
      const link = document.getElementById('adminLink');
      if (link) {
        link.style.display = 'inline-block';
        showToast('🔑 Acces administrator deblocat');
      }
    }
  });
}

// ── Landing button bindings ───────────────────────────────────────────────────
// Event delegation: works regardless of when/where the buttons render.
function bindLandingButtons() {
  const goAuth = (tab) => {
    showScreen('authScreen');
    document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.click();
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.id) return;
    if (btn.id.startsWith('landingStart'))      goAuth('register');
    else if (btn.id.startsWith('landingLogin')) goAuth('login');
    else if (btn.id === 'authBackBtn')          showScreen('landingScreen');
  });
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

  document.getElementById('accountBtn')?.addEventListener('click', () => navigateTo('profilePage'));

  document.getElementById('backToRealms')?.addEventListener('click', () => navigateTo('worldmapPage'));

  document.getElementById('backToLevelMap')?.addEventListener('click', () => {
    if (activeSubjectKey) openLevelMap(activeSubjectKey);
  });
}

// ── SFX toggle (sidebar) ──────────────────────────────────────────────────────
function bindSfxToggle() {
  const btn = document.getElementById('sfxToggleBtn');
  if (!btn) return;
  const sync = () => { btn.innerHTML = isSfxMuted() ? iconHTML('sound_off', '🔇') : iconHTML('sound_on', '🔊'); };
  sync();
  btn.addEventListener('click', () => { toggleSfxMuted(); sync(); });
}

// ── Navigation ────────────────────────────────────────────────────────────────
let currentPageId = 'homePage';
let _clanBuffs    = {};   // clan-wide buffs cache (expiry date keys)
let _chatUnsub    = null; // active clan-chat listener (detached on page change)
let _chatAvatars  = {};   // uid → { name, avatar } cache for message rendering
let _chatLastSend = 0;    // client-side rate limit

window.addEventListener('ct:lang', () => {
  const app = document.getElementById('appScreen');
  if (app && app.style.display !== 'none' && userData) renderPage(currentPageId);
});

function navigateTo(pageId) {
  playSfx('nav');
  renderPage(pageId);
}

function renderPage(pageId) {
  currentPageId = pageId;
  if (pageId !== 'clanPage' && _chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  showPage(pageId);

  if (pageId === 'homePage')      renderHomePage();
  if (pageId === 'inventoryPage') renderInventoryPage();
  if (pageId === 'missionsPage')  renderMissionsPage();
  if (pageId === 'clanPage')      renderClanPage();
  if (pageId === 'worldmapPage') {
    const interests = getPlayerProfile()?.interests || [];
    renderWorldMap(userData?.realmProgress || {}, interests, openLevelMap);
  }
  if (pageId === 'profilePage')  populateProfilePage();
  if (pageId === 'shopPage')     renderShopPage();
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
  document.getElementById('playerNameBattle').textContent = (userData?.displayName || 'Erou') + (userData?.clanTag ? ` [${userData.clanTag}]` : '');

  setBattlePlayerSprite();

  // Gen-3 style plate extras: Lv badges + player EXP bar
  const playerLv = userData?.level || 1;
  setText('playerLvBattle', 'Lv.' + playerLv);
  setText('enemyLvBattle',  'Lv.' + (levelIdx + 1));
  const expFill = document.getElementById('battleExpFill');
  if (expFill) {
    const pct = Math.min(100, Math.round(((userData?.xp || 0) / xpForLevel(playerLv)) * 100));
    expFill.style.width = pct + '%';
  }

  setDialogue(t(level.type === 'boss' ? 'gm.boss_warn' : level.type === 'lesson' ? 'gm.lesson' : 'gm.battle'));

  document.getElementById('startLessonBtn').style.display = '';
  document.getElementById('startBattleBtn').style.display = level.type !== 'lesson' ? '' : 'none';
  document.getElementById('continueBtn').style.display    = 'none';

  // Items + buffs visible from the start; consumables activate with questions
  renderConsumableBar({ enabled: false });
  renderPersistentPanel();
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

    playSfx('battle');
    setBattleActions('loading');
    document.getElementById('lessonContent').style.display = 'none';
    document.getElementById('dialogueBox').style.display   = '';
    setDialogue(t('battle.fight.loading'));

    battleManager = new BattleManager({
      subject:    activeSubjectKey,
      level,
      inventory:  userData?.inventory || [],
      onDialogue: setDialogue,
      onUpdateHP: ({ enemyHP, enemyMax, playerHP, playerMax }) => {
        updateBattleHP((enemyHP / enemyMax) * 100, (playerHP / playerMax) * 100);
        document.getElementById('enemyHpText').textContent  = `${enemyHP}/${enemyMax}`;
        document.getElementById('playerHpText').textContent = `${playerHP}/${playerMax}`;
      },
      onVictory: () => { handleVictory(); },
      onDefeat:  () => { handleDefeat(); },
      onConsumeItem: async (itemId) => {
        if (!currentUser || !userData) return;
        const inv = userData.inventory || [];
        const idx = inv.indexOf(itemId);
        if (idx !== -1) {
          userData.inventory = [...inv.slice(0, idx), ...inv.slice(idx + 1)];
          await saveUserData(currentUser.uid, { inventory: userData.inventory });
          refreshHUD();
        }
      },
    });

    try {
      await battleManager.loadQuestions();
      renderPersistentPanel();
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
    document.querySelectorAll('.pup-consumable:not(.pup-used)').forEach(b => b.disabled = true);

    const idx    = parseInt(btn.dataset.index, 10);
    const result = battleManager.answerQuestion(idx);
    if (!result) return;

    document.querySelectorAll('.answer-btn').forEach((b, i) => {
      if (i === result.correct)              b.classList.add('correct');
      else if (i === idx && !result.isCorrect) b.classList.add('wrong');
    });

    if (result.isCorrect) {
      playSfx('correct');
      shakeElement(document.getElementById('enemySprite'));
      missionEvent('correct', 1);
      if (result.damage > 0) missionEvent('damage', result.damage);
    } else {
      playSfx('wrong');
      shakeElement(document.getElementById('playerSprite'));
      // Clepsidra Timpului: reveal the correct answer after a mistake
      if (result.showHint) {
        const correct = battleManager.questions[battleManager.currentQ - 1]?.answers[result.correct];
        const hintEl  = document.getElementById('powerUpHint');
        if (hintEl && correct) {
          hintEl.textContent   = `⏳ Răspunsul corect era: "${correct}"`;
          hintEl.style.display = '';
        }
      }
    }

    renderPersistentPanel();

    await sleep(1200);

    const hintEl = document.getElementById('powerUpHint');
    if (hintEl) hintEl.style.display = 'none';

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

  renderConsumableBar({ enabled: true });
}

// ── Victory / Defeat ──────────────────────────────────────────────────────────
async function handleVictory() {
  playSfx('victory');
  confettiBurst();
  const level  = getLevel(activeSubjectKey, activeLevelIdx);
  const reward = getReward(level?.type || 'enemy');
  const acc    = battleManager ? battleManager.getAccuracy() : 100;

  // Equipment bonuses (equipped items give +% XP / +% gold)
  // Daily mission progress
  if (level?.type === 'lesson') missionEvent('lessons', 1);
  else                          missionEvent('battles', 1);

  const bon    = getEquipmentBonuses(userData?.equipped || []);
  let xpGain   = Math.round(reward.xp   * bon.xpMult);
  let goldGain = Math.round(reward.gold * bon.goldMult);

  // Clan-wide buffs (+10% while active, bought in the clan shop)
  const _tk = todayKey();
  if (_clanBuffs?.xp   && _clanBuffs.xp   >= _tk) xpGain   = Math.round(xpGain   * 1.10);
  if (_clanBuffs?.gold && _clanBuffs.gold >= _tk) goldGain = Math.round(goldGain * 1.10);

  await finishLevel(activeSubjectKey, activeLevelIdx, xpGain, goldGain);

  // Chest drop — enemies and bosses only, chances set by the admin config
  let chestLine = '';
  const chestTier = rollChestDrop(level?.type);
  if (chestTier) {
    const chest = CHEST_META[chestTier];
    userData.chests = [...(userData.chests || []), chestTier];
    try {
      await saveUserData(currentUser.uid, { chests: userData.chests });
      chestLine = `<br><span class="victory-chest">${emojiIcon(chest.icon)} ${t('chest.found', { name: t('chest.' + chestTier) })}</span>`;
      showToast(`${chest.icon} ${t('chest.toast', { name: t('chest.' + chestTier) })}`);
    } catch (err) {
      console.error('[chestDrop]', err);
      chestLine = '';
    }
  }

  showVictory(
      t('victory.title'),
      t('victory.msg', { acc, xp: xpGain, gold: goldGain }),
      `<span>+${xpGain} ${emojiIcon('✨')} XP</span>  <span>+${goldGain} ${emojiIcon('💰')}</span>${chestLine}`
  );
}

function handleDefeat() {
  playSfx('defeat');
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
    if (userData.clanId) contributeClanXp(userData.clanId, xpGain).catch(() => {});
  } catch (err) {
    console.error('[finishLevel]', err);
  }
}

// ── Shop ──────────────────────────────────────────────────────────────────────
// ── Home page (post-login landing) ────────────────────────────────────────────

// Pick the realm the player should continue: most progress but unfinished,
// else a favourite subject from onboarding, else the first subject.
function pickContinueTarget() {
  const rp        = userData?.realmProgress || {};
  const interests = getPlayerProfile()?.interests || userData?.profile?.interests || [];

  let best = null;
  SUBJECTS.forEach(s => {
    const done = (rp[s.key]?.completedLevels || []).length;
    if (done === 0 || done >= s.levels.length) return;
    if (!best || done > best.done) best = { subject: s, done };
  });

  if (!best) {
    const favKey  = interests.find(k => SUBJECTS.some(s => s.key === k));
    const subject = SUBJECTS.find(s => s.key === favKey) || SUBJECTS[0];
    const done    = (rp[subject.key]?.completedLevels || []).length;
    return { subject, levelIndex: getNextLevelIndex(subject.key, rp[subject.key]?.completedLevels || []), fresh: done === 0 };
  }
  return {
    subject:    best.subject,
    levelIndex: getNextLevelIndex(best.subject.key, rp[best.subject.key]?.completedLevels || []),
    fresh:      false,
  };
}

function subjectDisplayName(subject) {
  const key = 'subject.' + subject.key;
  const val = t(key);
  return val === key ? subject.name : val;
}

function renderHomePage() {
  const page = document.getElementById('homePage');
  if (!page || !userData) return;

  const level  = userData.level || 1;
  const xp     = userData.xp    || 0;
  const need   = xpForLevel(level);
  const pct    = Math.min(100, Math.round((xp / need) * 100));
  const name   = escapeHtml(userData.displayName || 'Erou')
               + (userData.clanTag ? ` <span class="char-tag">[${escapeHtml(userData.clanTag)}]</span>` : '');
  const avatar = avatarHTML(userData.avatar);

  const cont      = pickContinueTarget();
  const nextLevel = cont.subject.levels[cont.levelIndex];
  const typeLabel = nextLevel?.type === 'boss'   ? t('level.type.boss')
                  : nextLevel?.type === 'lesson' ? t('level.type.lesson')
                  : nextLevel?.type === 'enemy'  ? t('level.type.enemy')
                  : t('level.type.complete');

  // Aggregate realm progress
  const rp = userData.realmProgress || {};
  let totalLv = 0, doneLv = 0;
  SUBJECTS.forEach(s => {
    totalLv += s.levels.length;
    doneLv  += Math.min((rp[s.key]?.completedLevels || []).length, s.levels.length);
  });

  page.innerHTML = `
    <div class="home-shell">

      <aside class="rpg-panel char-panel">
        <div class="char-avatar">${avatar}</div>
        <div class="char-name">${name}</div>
        <div class="char-class">${getHeroClass(level)}</div>
        <div class="char-badge">${getHeroBadge(level)}</div>

        <div class="char-level-row">
          <span>${t('home.level', { lv: level })}</span>
          <span>${xp} / ${need} XP</span>
        </div>
        <div class="char-xp-track"><div class="char-xp-fill" style="width:${pct}%"></div></div>

        <div class="char-mini-stats">
          <div><b>${userData.gold || 0}</b><span>${t('home.stat.gold')}</span></div>
          <div><b>${userData.streak || 0}</b><span>${t('home.stat.streak')}</span></div>
          <div><b>${userData.battlesWon || 0}</b><span>${t('home.stat.wins')}</span></div>
          <div><b>${userData.lessonsCompleted || 0}</b><span>${t('home.stat.lessons')}</span></div>
        </div>

        <button class="rpg-panel-btn" id="homeProfileBtn" type="button">${t('home.profile.btn')}</button>
      </aside>

      <section class="home-main">

        <div class="rpg-panel quest-banner">
          <div>
            <div class="quest-eyebrow">${cont.fresh ? t('home.continue.eyebrow.start') : t('home.continue.eyebrow.resume')}</div>
            <div class="quest-title">
              <span class="quest-ic">${emojiIcon(cont.subject.icon)}</span>
              ${subjectDisplayName(cont.subject)}
            </div>
            <div class="quest-sub">${typeLabel} — ${t('home.levelN', { n: cont.levelIndex + 1 })}</div>
          </div>
          <button class="quest-go-btn" id="homeContinueBtn" type="button">
            ${cont.fresh ? t('home.continue.btn.start') : t('home.continue.btn.resume')}
          </button>
        </div>

        <div class="rpg-panel">
          <div class="home-realms-head">
            <h3>${t('home.realms')}</h3>
            <span>${t('home.realms.done', { done: doneLv, total: totalLv })}</span>
          </div>
          <div id="homeRealmList"></div>
          <button class="rpg-panel-btn home-worldmap-link" id="homeWorldmapBtn" type="button">${t('home.map.btn')}</button>
        </div>

      </section>
    </div>
  `;

  // Realm rows
  const list = page.querySelector('#homeRealmList');
  SUBJECTS.forEach(subject => {
    const done  = (rp[subject.key]?.completedLevels || []).length;
    const total = subject.levels.length;
    const rPct  = total > 0 ? Math.round((done / total) * 100) : 0;

    const row = document.createElement('button');
    row.className = 'home-realm-row';
    row.type      = 'button';
    row.innerHTML = `
      <span class="home-realm-ic">${emojiIcon(subject.icon)}</span>
      <span class="home-realm-name">${subjectDisplayName(subject)}</span>
      <div class="home-realm-track"><div class="home-realm-fill" style="width:${rPct}%; background:${subject.color};"></div></div>
      <span class="home-realm-meta">${done}/${total}</span>
    `;
    row.addEventListener('click', () => openLevelMap(subject.key));
    list.appendChild(row);
  });

  // Buttons
  page.querySelector('#homeContinueBtn')?.addEventListener('click', () => {
    activeSubjectKey = cont.subject.key;
    activeLevelIdx   = cont.levelIndex;
    if (cont.levelIndex >= cont.subject.levels.length) {
      openLevelMap(cont.subject.key);   // realm finished — show its map instead
    } else {
      startLevel(cont.subject.key, cont.levelIndex);
    }
  });
  page.querySelector('#homeProfileBtn')?.addEventListener('click',  () => navigateTo('profilePage'));
  page.querySelector('#homeWorldmapBtn')?.addEventListener('click', () => navigateTo('worldmapPage'));
}

// ── Inventory page (RPG slot-grid style) ─────────────────────────────────────
let _invSelection = null;   // { kind:'chest'|'equip'|'consum', ... } | null

function renderInventoryPage() {
  const page = document.getElementById('inventoryPage');
  if (!page || !userData) return;

  const chests    = userData.chests    || [];
  const equipment = userData.equipment || [];
  const equipped  = userData.equipped  || [];
  const consum    = userData.inventory || [];

  const counts  = {};
  consum.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const shopMap = Object.fromEntries(getShopItemsFromPowerups().map(i => [i.id, i]));
  const bagEquipment = equipment.filter(id => !equipped.includes(id));
  const bon = getEquipmentBonuses(equipped);

  page.innerHTML = `
    <div class="inv-rpg">

      <!-- Character / equipped panel -->
      <aside class="rpg-panel inv-char">
        <h3 class="rpg-panel-title">${t('inv.equipped')}</h3>
        <div class="inv-equip-slots" id="invEquipSlots"></div>
        <div class="inv-bonus">
          <div class="inv-bonus-row"><span>${t('inv.bonus.xp')}</span><b>+${Math.round((bon.xpMult - 1) * 100)}%</b></div>
          <div class="inv-bonus-row"><span>${t('inv.bonus.gold')}</span><b>+${Math.round((bon.goldMult - 1) * 100)}%</b></div>
        </div>
        <p class="inv-hint">${t('inv.hint')}</p>
      </aside>

      <!-- Satchel -->
      <section class="rpg-panel inv-bag">
        <h3 class="rpg-panel-title">${t('inv.bag')}</h3>

        <div class="inv-cat">${t('inv.chests')} ${chests.length ? `<i>${chests.length}</i>` : ''}</div>
        <div class="inv-slot-grid" id="invChestGrid"></div>

        <div class="inv-cat">${t('inv.equipment')}</div>
        <div class="inv-slot-grid" id="invEquipGrid"></div>

        <div class="inv-cat">${t('shop2.persistent')}</div>
        <div class="inv-slot-grid" id="invBuffGrid"></div>

        <div class="inv-cat">${t('inv.consumables')}</div>
        <div class="inv-slot-grid" id="invConsumGrid"></div>

        <div class="inv-detail" id="invDetail" style="display:none;"></div>
      </section>

    </div>
  `;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const mkSlot = ({ icon, cls = '', badge = '', selected = false, onClick = null, title = '' }) => {
    const b = document.createElement('button');
    b.type      = 'button';
    b.className = `inv-slot ${cls}${selected ? ' inv-slot--sel' : ''}`;
    b.title     = title;
    b.innerHTML = `<span class="inv-slot-ic">${emojiIcon(icon)}</span>${badge ? `<span class="inv-slot-badge">${badge}</span>` : ''}`;
    if (onClick) b.addEventListener('click', onClick);
    else b.disabled = true;
    return b;
  };
  const padEmpty = (grid, minSlots) => {
    while (grid.children.length < minSlots) {
      const e = document.createElement('div');
      e.className = 'inv-slot inv-slot--empty';
      grid.appendChild(e);
    }
  };
  const sameSel = (sel) => _invSelection
    && _invSelection.kind === sel.kind
    && _invSelection.id   === sel.id
    && _invSelection.idx  === sel.idx;
  const select = (sel) => {
    _invSelection = sameSel(sel) ? null : sel;
    renderInventoryPage();
  };

  // ── Equipped slots (always MAX_EQUIPPED squares) ────────────────────────────
  const equipSlotsEl = page.querySelector('#invEquipSlots');
  for (let i = 0; i < MAX_EQUIPPED; i++) {
    const id = equipped[i];
    if (id && EQUIPMENT_MAP[id]) {
      const item = EQUIPMENT_MAP[id];
      const sel  = { kind: 'equip', id };
      equipSlotsEl.appendChild(mkSlot({
        icon: item.icon,
        cls: `inv-slot--${item.rarity} inv-slot--worn`,
        selected: sameSel(sel),
        title: item.name,
        onClick: () => select(sel),
      }));
    } else {
      const e = document.createElement('div');
      e.className = 'inv-slot inv-slot--free';
      e.innerHTML = '<span class="inv-slot-plus">+</span>';
      equipSlotsEl.appendChild(e);
    }
  }

  // ── Chests ──────────────────────────────────────────────────────────────────
  const chestGrid = page.querySelector('#invChestGrid');
  chests.forEach((tier, idx) => {
    const meta = CHEST_META[tier] || CHEST_META.common;
    const sel  = { kind: 'chest', idx, tier };
    chestGrid.appendChild(mkSlot({
      icon: meta.icon,
      cls: `inv-slot--chest inv-slot--${tier}`,
      selected: sameSel(sel),
      title: t('chest.' + tier),
      onClick: () => select(sel),
    }));
  });
  padEmpty(chestGrid, 6);

  // ── Equipment (unequipped pieces live in the bag) ───────────────────────────
  const equipGrid = page.querySelector('#invEquipGrid');
  bagEquipment.forEach(id => {
    const item = EQUIPMENT_MAP[id];
    if (!item) return;
    const sel = { kind: 'equip', id };
    equipGrid.appendChild(mkSlot({
      icon: item.icon,
      cls: `inv-slot--${item.rarity}`,
      selected: sameSel(sel),
      title: item.name,
      onClick: () => select(sel),
    }));
  });
  padEmpty(equipGrid, 6);

  // ── Permanent buffs (persistent powerups you own) ───────────────────────────
  const buffGrid = page.querySelector('#invBuffGrid');
  [...new Set(consum)]
    .filter(id => POWERUP_MAP[id]?.type === 'persistent')
    .forEach(id => {
      const item = shopMap[id];
      const sel  = { kind: 'buff', id };
      buffGrid.appendChild(mkSlot({
        icon: item.icon,
        selected: sameSel(sel),
        title: item.name,
        onClick: () => select(sel),
      }));
    });
  padEmpty(buffGrid, 6);

  // ── Consumables ─────────────────────────────────────────────────────────────
  const consGrid = page.querySelector('#invConsumGrid');
  Object.entries(counts).forEach(([id, count]) => {
    const item = shopMap[id];
    if (!item || POWERUP_MAP[id]?.type !== 'consumable') return;
    const sel = { kind: 'consum', id };
    consGrid.appendChild(mkSlot({
      icon: item.icon,
      badge: '×' + count,
      selected: sameSel(sel),
      title: item.name,
      onClick: () => select(sel),
    }));
  });
  padEmpty(consGrid, 6);

  // ── Detail panel for the current selection ──────────────────────────────────
  renderInvDetail(page, { chests, equipped, shopMap, counts });
}

function renderInvDetail(page, ctx) {
  const box = page.querySelector('#invDetail');
  if (!box) return;
  const sel = _invSelection;
  if (!sel) { box.style.display = 'none'; return; }

  let icon = '', name = '', meta = '', desc = '', actionLabel = null, action = null;

  if (sel.kind === 'chest') {
    const tier = ctx.chests[sel.idx];
    if (tier === undefined) { _invSelection = null; box.style.display = 'none'; return; }
    const m = CHEST_META[tier] || CHEST_META.common;
    icon = m.icon; name = t('chest.' + tier);
    meta = t('inv.chest.meta');
    desc = t('inv.chest.desc');
    actionLabel = t('inv.open');
    action = () => { _invSelection = null; openChest(sel.idx); };
  }

  if (sel.kind === 'equip') {
    const item = EQUIPMENT_MAP[sel.id];
    if (!item) { _invSelection = null; box.style.display = 'none'; return; }
    const isOn = ctx.equipped.includes(sel.id);
    const r    = RARITY_META[item.rarity] || RARITY_META.common;
    icon = item.icon; name = item.name;
    meta = `<span style="color:${r.color}">${r.label}</span>${isOn ? ' · ' + t('inv.equipped') : ''}`;
    desc = item.desc;
    actionLabel = isOn ? t('inv.unequip') : t('inv.equip');
    action = () => toggleEquip(sel.id);
  }

  if (sel.kind === 'buff') {
    const item = ctx.shopMap[sel.id];
    if (!item || !ctx.counts[sel.id]) { _invSelection = null; box.style.display = 'none'; return; }
    icon = item.icon; name = item.name;
    meta = t('shop2.type.persist');
    desc = item.desc || '';
  }

  if (sel.kind === 'consum') {
    const item = ctx.shopMap[sel.id];
    if (!item || !ctx.counts[sel.id]) { _invSelection = null; box.style.display = 'none'; return; }
    icon = item.icon; name = item.name;
    meta = `${t('inv.consum.meta')} · ×${ctx.counts[sel.id]}`;
    desc = item.desc || t('inv.consum.autodesc');
  }

  box.style.display = '';
  box.innerHTML = `
    <span class="inv-detail-ic">${emojiIcon(icon)}</span>
    <div class="inv-detail-txt">
      <div class="inv-detail-name">${name}</div>
      <div class="inv-detail-meta">${meta}</div>
      <div class="inv-detail-desc">${desc}</div>
    </div>
    ${actionLabel ? `<button class="rpg-panel-btn rpg-panel-btn--gold" id="invDetailAction" type="button">${actionLabel}</button>` : ''}
  `;
  if (action) box.querySelector('#invDetailAction')?.addEventListener('click', action);
}

// ── Open a chest ──────────────────────────────────────────────────────────────
async function openChest(chestIndex) {
  if (!currentUser || !userData) return;
  const chests = userData.chests || [];
  const tier   = chests[chestIndex];
  if (!tier) return;

  const loot    = openChestRoll(tier);
  const updates = { chests: [...chests.slice(0, chestIndex), ...chests.slice(chestIndex + 1)] };
  let   reveal  = null;

  if (loot.type === 'equipment') {
    const owned = userData.equipment || [];
    if (owned.includes(loot.id)) {
      // Duplicate piece → gold consolation instead
      const consolation = Math.round((loot.item.rarity === 'epic' ? 120 : loot.item.rarity === 'rare' ? 60 : 30));
      updates.gold = (userData.gold || 0) + consolation;
      reveal = { icon: '💰', title: t('loot.gold', { n: consolation }), sub: t('loot.dup', { name: loot.item.name }) };
    } else {
      updates.equipment = [...owned, loot.id];
      reveal = { icon: loot.item.icon, title: loot.item.name, sub: loot.item.desc };
    }
  } else if (loot.type === 'consumable') {
    updates.inventory = [...(userData.inventory || []), loot.id];
    reveal = { icon: loot.item.icon, title: loot.item.name, sub: t('loot.consum.sub') };
  } else {
    updates.gold = (userData.gold || 0) + loot.amount;
    reveal = { icon: '💰', title: t('loot.gold', { n: loot.amount }), sub: t('loot.gold.sub') };
  }

  try {
    await saveUserData(currentUser.uid, updates);
    Object.assign(userData, updates);
    playSfx('buy');
    confettiBurst();
    refreshHUD();
    missionEvent('chests', 1);
    showLootReveal(tier, reveal);
    renderInventoryPage();
  } catch (err) {
    console.error('[openChest]', err);
    showToast(t('loot.fail'));
    renderInventoryPage();
  }
}

// ── Loot reveal modal ─────────────────────────────────────────────────────────
function showLootReveal(tier, reveal) {
  document.getElementById('lootModal')?.remove();
  const meta    = CHEST_META[tier] || CHEST_META.common;
  const overlay = document.createElement('div');
  overlay.id        = 'lootModal';
  overlay.className = 'avatar-modal-overlay';
  overlay.innerHTML = `
    <div class="rpg-panel avatar-modal loot-modal">
      <div class="loot-chest-ic">${emojiIcon(meta.icon)}</div>
      <div class="loot-item-ic">${emojiIcon(reveal.icon)}</div>
      <h3 class="loot-title">${reveal.title}</h3>
      <p class="loot-sub">${reveal.sub}</p>
      <button class="rpg-panel-btn rpg-panel-btn--gold" id="lootOkBtn" type="button" style="width:100%">${t('loot.ok')}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
  const close = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 300);
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#lootOkBtn').addEventListener('click', close);
}

// ── Equip / unequip ───────────────────────────────────────────────────────────
async function toggleEquip(itemId) {
  if (!currentUser || !userData) return;
  const equipped = userData.equipped || [];
  let next;

  if (equipped.includes(itemId)) {
    next = equipped.filter(id => id !== itemId);
  } else {
    if (equipped.length >= MAX_EQUIPPED) {
      return showToast(t('inv.maxequip', { max: MAX_EQUIPPED }));
    }
    next = [...equipped, itemId];
  }

  try {
    await saveUserData(currentUser.uid, { equipped: next });
    userData.equipped = next;
    renderInventoryPage();
  } catch (err) {
    console.error('[equip]', err);
    showToast(t('inv.savefail'));
  }
}

// ── Profile page ──────────────────────────────────────────────────────────────
const AVATARS = ['🐱','🐈‍⬛','🦊','🐺','🦉','🐯','🦁','🐸','🐢','🐉','🦅','🦝'];

function populateProfilePage() {
  if (!userData) return;
  const level = userData.level || 1;
  const xp    = userData.xp    || 0;
  const need  = xpForLevel(level);
  const pct   = Math.min(100, Math.round((xp / need) * 100));

  setAvatarEl('accAvatar', userData.avatar);
  setText('accName',    (userData.displayName || 'Erou') + (userData.clanTag ? ` [${userData.clanTag}]` : ''));
  setText('accClass',   getHeroClass(level));
  setText('accBadge',   getHeroBadge(level));
  setText('accLevel',   level);
  setText('accXP',      xp);
  setText('accGold',    userData.gold || 0);
  setText('accBattles', userData.battlesWon || 0);
  setText('accLessons', userData.lessonsCompleted || 0);
  setText('accStreak',  userData.streak || 0);

  // Inline level + XP bar in the identity card
  setText('profLevelInline', level);
  setText('profXpLabel', `${xp} / ${need} XP`);
  const fill = document.getElementById('profXpFill');
  if (fill) fill.style.width = pct + '%';

  renderRealmProgress(userData.realmProgress || {});
  renderAchievements(getAchievements(), userData.achievements || []);
  renderSettings(userData);

  // Sub-tab switching — onclick assignment keeps this idempotent across visits
  document.querySelectorAll('.account-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.account-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.acc-tab-content').forEach(el => el.style.display = 'none');
      const target = document.getElementById('accTab' + capitalise(btn.dataset.accTab));
      if (target) target.style.display = '';
    };
  });

  // ── Avatar change ──────────────────────────────────────────────────────────
  const avatarBtn = document.getElementById('avatarEditBtn');
  if (avatarBtn) avatarBtn.onclick = openAvatarModal;

  // ── Username change ────────────────────────────────────────────────────────
  const editBtn   = document.getElementById('nameEditBtn');
  const form      = document.getElementById('nameEditForm');
  const input     = document.getElementById('nameEditInput');
  const saveBtn   = document.getElementById('nameSaveBtn');
  const cancelBtn = document.getElementById('nameCancelBtn');

  if (editBtn) editBtn.onclick = () => {
    if (!form || !input) return;
    input.value        = userData.displayName || '';
    form.style.display = '';
    input.focus();
  };
  if (cancelBtn) cancelBtn.onclick = () => { if (form) form.style.display = 'none'; };
  if (saveBtn) saveBtn.onclick = async () => {
    const newName = (input?.value || '').trim();
    if (newName.length < 2)  return showToast(t('prof.name.min'));
    if (newName.length > 20) return showToast(t('prof.name.max'));
    saveBtn.disabled = true;
    try {
      await changeDisplayName(newName);
      await saveUserData(currentUser.uid, { displayName: newName });
      userData.displayName = newName;
      setText('accName', newName + (userData.clanTag ? ` [${userData.clanTag}]` : ''));
      refreshHUD();
      if (form) form.style.display = 'none';
      showToast(t('prof.name.done'));
    } catch (err) {
      showToast(t('prof.name.fail'));
      console.error('[changeName]', err);
    } finally {
      saveBtn.disabled = false;
    }
  };

  // Listen for progress reset from settings.js
  window.addEventListener('userDataReset', async () => {
    userData = await loadUserData(currentUser.uid);
    refreshHUD();
    populateProfilePage();
  }, { once: true });
}

// ── Avatar picker modal ───────────────────────────────────────────────────────
function openAvatarModal() {
  document.getElementById('avatarModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'avatarModal';
  overlay.className = 'avatar-modal-overlay';
  overlay.innerHTML = `
    <div class="rpg-panel avatar-modal">
      <h3 class="rpg-panel-title">${t('av.title')}</h3>

      <div class="avatar-upload-row">
        <button class="rpg-panel-btn rpg-panel-btn--gold" id="avatarUploadBtn" type="button">${t('av.upload')}</button>
        <input type="file" id="avatarFileInput" accept="image/*" style="display:none">
        <p class="avatar-upload-hint">${t('av.hint')}</p>
      </div>

      <div class="avatar-divider"><span>${t('av.or')}</span></div>

      <div class="avatar-grid">
        ${AVATARS.map(a => `
          <button class="avatar-option${a === (userData?.avatar || '🐱') ? ' selected' : ''}"
                  data-avatar="${a}" type="button">${a}</button>
        `).join('')}
      </div>

      <button class="rpg-panel-btn" id="avatarCloseBtn" type="button" style="width:100%">${t('av.close')}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const close = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 300);
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#avatarCloseBtn').addEventListener('click', close);

  // ── Preset selection ───────────────────────────────────────────────────────
  overlay.querySelectorAll('.avatar-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      overlay.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      await saveAvatar(btn.dataset.avatar, close);
    });
  });

  // ── Image upload ───────────────────────────────────────────────────────────
  const uploadBtn = overlay.querySelector('#avatarUploadBtn');
  const fileInput = overlay.querySelector('#avatarFileInput');

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('av.notimage'));
      return;
    }

    uploadBtn.disabled    = true;
    uploadBtn.textContent = t('av.processing');
    try {
      const dataUrl = await imageToAvatarDataUrl(file);
      await saveAvatar(dataUrl, close);
    } catch (err) {
      console.error('[avatarUpload]', err);
      showToast(err.message === 'too-big' ? t('av.toobig') : t('av.badfile'));
      uploadBtn.disabled    = false;
      uploadBtn.textContent = t('av.upload');
    }
  });
}

// Save an avatar value (emoji preset or image data URL) everywhere
async function saveAvatar(avatar, onDone) {
  try {
    await saveUserData(currentUser.uid, { avatar });
    userData.avatar = avatar;
    setAvatarEl('accAvatar', avatar);
    refreshHUD();
    showToast(t('av.changed'));
    onDone?.();
  } catch (err) {
    showToast(t('av.fail'));
    console.error('[avatar]', err);
  }
}

// ── Avatar image processing ───────────────────────────────────────────────────
// Loads the file, center-crops to a square, resizes to 500×500 and compresses
// to a JPEG data URL small enough for the Firestore 1MB document limit.
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid-image')); };
    img.src = url;
  });
}

async function imageToAvatarDataUrl(file) {
  const img  = await fileToImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx   = (img.naturalWidth  - side) / 2;
  const sy   = (img.naturalHeight - side) / 2;

  const canvas  = document.createElement('canvas');
  canvas.width  = 500;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, 500, 500);

  // Compress progressively until it fits comfortably in the Firestore doc
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 700_000 && quality > 0.4) {
    quality -= 0.15;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > 900_000) throw new Error('too-big');
  return dataUrl;
}

// ── Avatar display helpers (emoji preset OR uploaded image) ───────────────────
function isImageAvatar(av) {
  return typeof av === 'string' && (av.startsWith('data:image') || av.startsWith('http'));
}

function avatarHTML(av) {
  const a = av || '🐱';
  return isImageAvatar(a) ? `<img src="${a}" alt="avatar" class="avatar-img">` : a;
}

function setAvatarEl(id, av) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = avatarHTML(av);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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

// ── Shop page (RPG rework: merchant + category shelves) ──────────────────────
function renderShopPage() {
  const page = document.getElementById('shopPage');
  if (!page || !userData) return;

  const inv    = userData.inventory || [];
  const counts = {};
  inv.forEach(id => { counts[id] = (counts[id] || 0) + 1; });

  page.innerHTML = `
    <div class="shop2-shell">
      <div class="rpg-panel shop2-merchant">
        <img src="assets/Profesor.png" class="shop2-merchant-img" alt="">
        <div class="shop2-merchant-txt">
          <h2 class="shop2-title">${t('shop2.title')}</h2>
          <p class="shop2-greet">„${t('shop2.greet')}”</p>
        </div>
        <div class="shop2-gold">${emojiIcon('💰')} <b>${userData.gold || 0}</b></div>
      </div>
      <div id="shopShelves" class="shop2-shelves"></div>
    </div>
  `;

  const shelves = page.querySelector('#shopShelves');

  SHOP_CATEGORIES.forEach(cat => {
    const section = document.createElement('section');
    section.className = 'rpg-panel shop2-shelf';
    section.innerHTML = `
      <div class="shop2-cat-head">
        <span class="shop2-cat-ic">${emojiIcon(cat.icon)}</span>
        <h3>${t('shopcat.' + cat.id)}</h3>
        <span class="shop2-cat-line"></span>
      </div>
      <div class="shop2-grid"></div>
    `;
    const grid = section.querySelector('.shop2-grid');

    if (cat.id === 'chests') {
      const prices = getLootConfig().chestPrices || {};
      ['common', 'rare', 'epic'].forEach(tier => {
        const meta  = CHEST_META[tier];
        const price = prices[tier] ?? 0;
        grid.appendChild(shopCard({
          icon:   meta.icon,
          name:   t('chest.' + tier),
          type:   'chest',
          desc:   t('shop2.chest.desc'),
          typeLabel: t('shop2.type.chest'),
          price,
          cls:    `shop2-card--chest shop2-card--${tier}`,
          canBuy: (userData.gold || 0) >= price,
          onBuy:  () => handleBuyChest(tier, price),
        }));
      });
    } else {
      POWERUPS.filter(p => p.category === cat.id).forEach(item => {
        const persistent = item.type === 'persistent';
        const owned      = persistent && inv.includes(item.id);
        grid.appendChild(shopCard({
          icon:   item.icon,
          name:   item.name,
          type:   item.type,
          desc:   item.desc || '',
          typeLabel: persistent ? t('shop2.type.persist') : t('shop2.type.consum'),
          price:  item.price,
          count:  !persistent ? (counts[item.id] || 0) : 0,
          owned,
          qty:    !persistent,
          canBuy: !owned && (userData.gold || 0) >= item.price,
          onBuy:  (qty) => handleBuyQty(item, qty),
        }));
      });
    }

    if (grid.children.length) shelves.appendChild(section);
  });
}

function shopCard({ icon, name, type, desc, typeLabel = '', price, count = 0, owned = false, qty = false, canBuy, onBuy, cls = '' }) {
  const card = document.createElement('div');
  card.className = `shop2-card ${cls}${owned ? ' shop2-card--owned' : ''}`;
  card.innerHTML = `
    ${count ? `<span class="shop2-count">${t('shop2.have', { n: count })}</span>` : ''}
    ${owned ? `<span class="shop2-owned-badge">${t('shop2.owned')}</span>` : ''}
    <span class="shop2-ic">${emojiIcon(icon)}</span>
    <span class="shop2-name">${name}</span>
    ${typeLabel ? `<span class="shop2-type shop2-type--${type}">${typeLabel}</span>` : ''}
    <span class="shop2-desc">${desc}</span>
    ${qty ? `
      <div class="shop2-qty">
        <button class="shop2-qty-btn" data-d="-1" type="button">−</button>
        <span class="shop2-qty-val">1</span>
        <button class="shop2-qty-btn" data-d="1" type="button">+</button>
      </div>` : ''}
    <div class="shop2-foot">
      <span class="shop2-price"><b>${price}</b> ${emojiIcon('💰')}</span>
      <button class="rpg-panel-btn${canBuy ? ' rpg-panel-btn--gold' : ''}" type="button"
              ${owned || !canBuy ? 'disabled' : ''}
              title="${!canBuy && !owned ? t('shop2.poor') : ''}">
        ${owned ? t('shop2.owned') : t('shop2.buy')}
      </button>
    </div>
  `;

  let q = 1;
  const priceEl = card.querySelector('.shop2-price b');
  const buyBtn  = card.querySelector('.shop2-foot button');

  if (qty) {
    const valEl = card.querySelector('.shop2-qty-val');
    card.querySelectorAll('.shop2-qty-btn').forEach(b => b.addEventListener('click', () => {
      q = Math.min(10, Math.max(1, q + Number(b.dataset.d)));
      valEl.textContent   = q;
      priceEl.textContent = price * q;
      const afford = (userData.gold || 0) >= price * q;
      buyBtn.disabled = !afford;
      buyBtn.classList.toggle('rpg-panel-btn--gold', afford);
      buyBtn.title = afford ? '' : t('shop2.poor');
    }));
  }
  if (onBuy) buyBtn.addEventListener('click', () => { if (!buyBtn.disabled) onBuy(q); });
  return card;
}

async function handleBuyQty(item, qty = 1) {
  if (!currentUser || !userData) return;
  qty = Math.max(1, Math.min(10, qty));
  const cost = item.price * qty;
  if ((userData.gold || 0) < cost) return showToast(t('shop2.poor'));

  const prevGold = userData.gold;
  const prevInv  = userData.inventory || [];
  try {
    userData.gold      = prevGold - cost;
    userData.inventory = [...prevInv, ...Array(qty).fill(item.id)];
    await saveUserData(currentUser.uid, { gold: userData.gold, inventory: userData.inventory });
    playSfx('buy');
    refreshHUD();
    renderShopPage();
    showToast(t('toast.shop.bought', { name: item.name + (qty > 1 ? ` ×${qty}` : '') }));
  } catch (err) {
    userData.gold      = prevGold;      // rollback on failed save
    userData.inventory = prevInv;
    console.error('[buy]', err);
    showToast(t('toast.shop.broke'));
  }
}

async function handleBuyChest(tier, price) {
  if (!currentUser || !userData) return;
  if ((userData.gold || 0) < price) return showToast(t('shop2.poor'));

  const prevGold   = userData.gold;
  const prevChests = userData.chests || [];
  try {
    userData.gold   = prevGold - price;
    userData.chests = [...prevChests, tier];
    await saveUserData(currentUser.uid, { gold: userData.gold, chests: userData.chests });
    playSfx('buy');
    confettiBurst();
    refreshHUD();
    renderShopPage();
    showToast(`${CHEST_META[tier].icon} ${t('chest.toast', { name: t('chest.' + tier) })}`);
  } catch (err) {
    userData.gold   = prevGold;
    userData.chests = prevChests;
    console.error('[buyChest]', err);
    showToast(t('toast.shop.broke'));
  }
}

// ── Daily missions engine ─────────────────────────────────────────────────────
let _missionSaveTimer = null;

function missionEvent(stat, amount = 1) {
  if (!currentUser || !userData || amount <= 0) return;
  const daily = getDailyMissions();

  // Player missions — local progress, debounced save
  ensurePlayerMissionState(userData);
  let touched = false;
  daily.player.forEach(m => {
    if (m.stat !== stat) return;
    if (userData.missions.claimed.includes(m.id)) return;
    const cur = userData.missions.progress[m.id] || 0;
    if (cur >= m.target) return;
    userData.missions.progress[m.id] = Math.min(m.target, cur + amount);
    touched = true;
  });
  if (touched) {
    clearTimeout(_missionSaveTimer);
    _missionSaveTimer = setTimeout(() => {
      saveUserData(currentUser.uid, { missions: userData.missions }).catch(() => {});
    }, 1500);
  }

  // Clan missions — shared progress on the clan doc
  if (userData.clanId) {
    const amounts = {};
    daily.clan.forEach(m => { if (m.stat === stat) amounts[m.id] = amount; });
    if (Object.keys(amounts).length) {
      contributeClanMissions(userData.clanId, todayKey(), amounts).catch(() => {});
    }
  }
}

// ── Missions page ─────────────────────────────────────────────────────────────
async function renderMissionsPage() {
  const page = document.getElementById('missionsPage');
  if (!page || !userData) return;

  const daily = getDailyMissions();
  if (ensurePlayerMissionState(userData)) {
    saveUserData(currentUser.uid, { missions: userData.missions }).catch(() => {});
  }
  ensureClanClaimState(userData);

  page.innerHTML = `
    <div class="msn-shell">
      <div class="msn-head">
        <h2>${t('msn.title')}</h2>
        <span class="msn-date">${t('msn.reset')}</span>
      </div>

      <section class="rpg-panel">
        <h3 class="rpg-panel-title">${t('msn.yours')}</h3>
        <div id="msnPlayerList"></div>
      </section>

      <section class="rpg-panel">
        <h3 class="rpg-panel-title">${t('msn.clan')}</h3>
        <div id="msnClanList"><p class="inv-empty">${t('msn.loading')}</p></div>
      </section>
    </div>
  `;

  // ── Player missions ─────────────────────────────────────────────────────────
  const pList = page.querySelector('#msnPlayerList');
  pList.innerHTML = '';
  daily.player.forEach(m => {
    const prog    = Math.min(m.target, userData.missions.progress[m.id] || 0);
    const claimed = userData.missions.claimed.includes(m.id);
    const done    = prog >= m.target;
    pList.appendChild(missionRow(m, prog, claimed, done, t('msn.reward.gold', { n: m.reward.gold }), async (btn) => {
      btn.disabled = true;
      userData.missions.claimed.push(m.id);
      userData.gold = (userData.gold || 0) + m.reward.gold;
      try {
        await saveUserData(currentUser.uid, { missions: userData.missions, gold: userData.gold });
        playSfx('buy');
        confettiBurst();
        refreshHUD();
        showToast(t('msn.toast.gold', { n: m.reward.gold }));
      } catch (err) {
        console.error('[missionClaim]', err);
      }
      renderMissionsPage();
    }));
  });

  // ── Clan missions ───────────────────────────────────────────────────────────
  const cList = page.querySelector('#msnClanList');
  if (!userData.clanId) {
    cList.innerHTML = `
      <p class="inv-empty">${t('msn.noclan')}</p>
      <button class="rpg-panel-btn rpg-panel-btn--gold" id="msnGoClan" type="button">${t('msn.findclan')}</button>`;
    cList.querySelector('#msnGoClan')?.addEventListener('click', () => navigateTo('clanPage'));
    return;
  }

  let clan = null;
  try { clan = await getClanById(userData.clanId); } catch (_) {}
  if (!clan) {
    cList.innerHTML = `<p class="inv-empty">${t('msn.clanfail')}</p>`;
    return;
  }

  const clanProg = (clan.missions?.date === todayKey()) ? (clan.missions.progress || {}) : {};
  cList.innerHTML = '';
  daily.clan.forEach(m => {
    const prog    = Math.min(m.target, clanProg[m.id] || 0);
    const done    = prog >= m.target;
    const claimed = userData.clanMissionsClaimed.ids.includes(m.id);
    cList.appendChild(missionRow(m, prog, claimed, done, t('msn.reward.coins', { n: m.reward.coins }), async (btn) => {
      btn.disabled = true;
      userData.clanMissionsClaimed.ids.push(m.id);
      userData.clanCoins = (userData.clanCoins || 0) + m.reward.coins;
      try {
        await saveUserData(currentUser.uid, {
          clanMissionsClaimed: userData.clanMissionsClaimed,
          clanCoins:           userData.clanCoins,
        });
        playSfx('buy');
        confettiBurst();
        showToast(t('msn.toast.coins', { n: m.reward.coins }));
      } catch (err) {
        console.error('[clanMissionClaim]', err);
      }
      renderMissionsPage();
    }));
  });
}

function missionRow(m, prog, claimed, done, rewardLabel, onClaim) {
  const pct = Math.round((prog / m.target) * 100);
  const row = document.createElement('div');
  row.className = `msn-row${claimed ? ' msn-row--claimed' : done ? ' msn-row--done' : ''}`;
  row.innerHTML = `
    <span class="msn-ic">${emojiIcon(m.icon)}</span>
    <div class="msn-body">
      <div class="msn-name">${t('mission.' + m.id)}</div>
      <div class="msn-track"><div class="msn-fill" style="width:${pct}%"></div></div>
      <div class="msn-meta"><span>${prog} / ${m.target}</span><span class="msn-reward">${rewardLabel}</span></div>
    </div>
    <div class="msn-action"></div>
  `;
  const slot = row.querySelector('.msn-action');
  if (claimed) {
    slot.innerHTML = '<span class="msn-check">✓</span>';
  } else if (done) {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'rpg-panel-btn rpg-panel-btn--gold';
    btn.textContent = t('msn.claim');
    btn.addEventListener('click', () => onClaim(btn));
    slot.appendChild(btn);
  }
  return row;
}

const CLAN_SHOP = [
  { key: 'xp',   icon: '✨', cost: 30, days: 1 },
  { key: 'gold', icon: '💰', cost: 30, days: 1 },
];

// ── Clan chat (Discord-style) ─────────────────────────────────────────────────
function initClanChat(page, clan) {
  const box    = page.querySelector('#chatBox');
  const input  = page.querySelector('#chatInput');
  const sendBt = page.querySelector('#chatSendBtn');
  const attach = page.querySelector('#chatAttachBtn');
  const fileIn = page.querySelector('#chatFileIn');
  if (!box) return;

  // live subscription (previous one is detached by renderPage)
  if (_chatUnsub) _chatUnsub();
  _chatUnsub = listenClanMessages(clan.id, async (msgs, err) => {
    if (err || !msgs) { box.innerHTML = `<p class="inv-empty">${t('clan.leave.fail')}</p>`; return; }
    await renderChatMessages(box, msgs, clan);
  });

  const doSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    const now = Date.now();
    if (now - _chatLastSend < 750) return showToast(t('chat.slow'));

    _chatLastSend = now;
    input.value = '';
    try {
      await sendClanMessage(clan.id, {
        uid:  currentUser.uid,
        name: userData.displayName,
        text,
      });
    } catch (err) {
      console.error('[chatSend]', err);
      showToast(t('chat.sendfail'));
    }
  };
  sendBt.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });

  attach.addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files?.[0];
    fileIn.value = '';
    if (!file) return;
    // Hard whitelist — the accept attribute is advisory only. SVG excluded
    // deliberately (script-capable format).
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED.includes(file.type)) return showToast(t('chat.notimg'));
    const now = Date.now();
    if (now - _chatLastSend < 1500) return showToast(t('chat.slow'));
    try {
      let dataUrl;
      if (file.type === 'image/gif') {
        if (file.size > 350_000) return showToast(t('chat.gifbig'));
        if (!(await isRealGif(file))) return showToast(t('chat.notimg'));
        dataUrl = await fileToDataUrl(file);          // raw — keeps animation
      } else {
        dataUrl = await resizeImageForChat(file);     // downscaled JPEG
      }
      if (dataUrl.length > 500_000) return showToast(t('chat.imgbig'));
      _chatLastSend = now;
      await sendClanMessage(clan.id, {
        uid:  currentUser.uid,
        name: userData.displayName,
        img:  dataUrl,
      });
    } catch (err) {
      console.error('[chatImg]', err);
      showToast(err.message === 'img-too-big' ? t('chat.imgbig') : t('chat.sendfail'));
    }
  });
}

async function renderChatMessages(box, msgs, clan) {
  if (msgs.length === 0) {
    box.innerHTML = `<p class="inv-empty">${t('chat.empty')}</p>`;
    return;
  }

  // resolve avatars for senders we haven't seen (members + ex-members)
  const unknown = [...new Set(msgs.map(m => m.uid))].filter(u => !_chatAvatars[u]);
  await Promise.all(unknown.map(async (uid) => {
    try {
      const d = await loadUserData(uid);
      _chatAvatars[uid] = { avatar: d?.avatar || null, name: d?.displayName || null };
    } catch { _chatAvatars[uid] = { avatar: null, name: null }; }
  }));

  const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const isOwner     = clan.ownerUid === currentUser.uid;

  box.innerHTML = '';
  let prevUid = null, prevTime = 0;
  msgs.forEach(msg => {
    const ts      = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : Date.now();
    const grouped = msg.uid === prevUid && (ts - prevTime) < 5 * 60 * 1000;
    prevUid = msg.uid; prevTime = ts;

    const info   = _chatAvatars[msg.uid] || {};
    const avHTML = info.avatar && isImageAvatar(info.avatar)
      ? `<img class="chat-av-img" src="${info.avatar}" alt="">`
      : `<span class="chat-av-emoji">${emojiIcon(info.avatar || '🐱')}</span>`;
    const when = new Date(ts).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

    const row = document.createElement('div');
    row.className = 'chat-msg' + (grouped ? ' chat-msg--grouped' : '');
    row.innerHTML = `
      <div class="chat-av">${grouped ? '' : avHTML}</div>
      <div class="chat-body">
        ${grouped ? '' : `<div class="chat-head">
          <span class="chat-name">${escapeHtml(msg.name || 'Erou')}</span>
          <span class="chat-time">${when}</span>
        </div>`}
        ${msg.text ? `<div class="chat-text">${escapeHtml(msg.text)}</div>` : ''}
        ${msg.img && msg.img.startsWith('data:image/') ? `<img class="chat-img" src="${msg.img}" alt="" loading="lazy">` : ''}
      </div>
    `;
    if (msg.uid === currentUser.uid || isOwner) {
      const del = document.createElement('button');
      del.type        = 'button';
      del.className   = 'chat-del';
      del.title       = t('chat.del');
      del.innerHTML = emojiIcon('🗑');
      del.addEventListener('click', () => deleteClanMessage(clan.id, msg.id).catch(() => {}));
      row.appendChild(del);
    }
    box.appendChild(row);
  });

  if (wasAtBottom) box.scrollTop = box.scrollHeight;
}

/** MIME types come from file extensions and can lie — check the magic bytes. */
async function isRealGif(file) {
  try {
    const buf = new Uint8Array(await file.slice(0, 6).arrayBuffer());
    const sig = String.fromCharCode(...buf);
    return sig === 'GIF87a' || sig === 'GIF89a';
  } catch { return false; }
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = () => rej(new Error('read-failed'));
    r.readAsDataURL(file);
  });
}

/** Downscale to ≤640px on the long edge, JPEG. */
function resizeImageForChat(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale  = Math.min(1, 640 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad-image')); };
    img.src = url;
  });
}

// ── Clan page ─────────────────────────────────────────────────────────────────
async function renderClanPage() {
  const page = document.getElementById('clanPage');
  if (!page || !userData) return;

  // Not in a clan → create / join
  if (!userData.clanId) {
    page.innerHTML = `
      <div class="clan-shell">
        <section class="rpg-panel">
          <h3 class="rpg-panel-title">${t('clan.create.title')}</h3>
          <div class="clan-form">
            <input class="rpg-input" id="clanNameIn" maxlength="24" placeholder="${t('clan.name.ph')}">
            <input class="rpg-input" id="clanTagIn"  maxlength="4"  placeholder="${t('clan.tag.ph')}">
            <div class="clan-emblems" id="clanEmblems"></div>
            <button class="rpg-panel-btn rpg-panel-btn--gold" id="clanCreateBtn" type="button">${t('clan.create.btn')}</button>
          </div>
        </section>
        <section class="rpg-panel">
          <h3 class="rpg-panel-title">${t('clan.join.title')}</h3>
          <div class="clan-form">
            <input class="rpg-input" id="clanCodeIn" maxlength="6" placeholder="${t('clan.code.ph')}">
            <button class="rpg-panel-btn rpg-panel-btn--gold" id="clanJoinBtn" type="button">${t('clan.join.btn')}</button>
            <p class="inv-empty">${t('clan.code.hint')}</p>
          </div>
        </section>

        <section class="rpg-panel">
          <h3 class="rpg-panel-title">${t('clan.list.title')}</h3>
          <div class="clan-list" id="clanListEl"><p class="inv-empty">${t('clan.list.loading')}</p></div>
        </section>
      </div>
    `;

    const EMBLEMS = ['🛡️','⚔️','🐉','🦁','🐺','🦅','🔥','🌙','⭐','👑'];
    let emblem = EMBLEMS[0];
    const embEl = page.querySelector('#clanEmblems');
    EMBLEMS.forEach((e, i) => {
      const b = document.createElement('button');
      b.type      = 'button';
      b.className = 'clan-emblem' + (i === 0 ? ' selected' : '');
      b.innerHTML = emojiIcon(e);
      b.addEventListener('click', () => {
        embEl.querySelectorAll('.clan-emblem').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        emblem = e;
      });
      embEl.appendChild(b);
    });

    page.querySelector('#clanCreateBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const clan = await createClan(currentUser.uid, userData.displayName, {
          name: page.querySelector('#clanNameIn').value,
          tag:  page.querySelector('#clanTagIn').value,
          emblem,
        });
        userData.clanId  = clan.id;
        userData.clanTag = clan.tag;
        await saveUserData(currentUser.uid, { clanId: clan.id, clanTag: clan.tag });
        refreshHUD();
        showToast(t('clan.founded', { name: clan.name }));
        confettiBurst();
        renderClanPage();
      } catch (err) {
        showToast(err.message || t('clan.create.fail'));
        e.target.disabled = false;
      }
    });

    page.querySelector('#clanJoinBtn').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const clan = await joinClan(currentUser.uid, userData.displayName, page.querySelector('#clanCodeIn').value);
        userData.clanId  = clan.id;
        userData.clanTag = clan.tag;
        await saveUserData(currentUser.uid, { clanId: clan.id, clanTag: clan.tag });
        refreshHUD();
        showToast(t('clan.welcome', { name: clan.name }));
        confettiBurst();
        renderClanPage();
      } catch (err) {
        showToast(err.message || t('clan.join.fail'));
        e.target.disabled = false;
      }
    });

    loadClanList(page);
    return;
  }

  // In a clan → clan view
  page.innerHTML = `<div class="clan-shell"><p class="inv-empty">${t('clan.loading')}</p></div>`;
  let clan = null;
  try { clan = await getClanById(userData.clanId); } catch (_) {}
  _clanBuffs = clan?.buffs || {};

  if (!clan) {
    // Clan was dissolved — clean up
    userData.clanId  = null;
    userData.clanTag = null;
    await saveUserData(currentUser.uid, { clanId: null, clanTag: null }).catch(() => {});
    refreshHUD();
    renderClanPage();
    return;
  }

  const isOwner = clan.ownerUid === currentUser.uid;
  page.innerHTML = `
    <div class="clan-shell">
      <section class="rpg-panel clan-header">
        <div class="clan-emblem-big">${emojiIcon(clan.emblem || '🛡️')}</div>
        <div class="clan-id">
          <h2 class="clan-name">${escapeHtml(clan.name)} <span class="clan-tag">[${escapeHtml(clan.tag)}]</span></h2>
          <div class="clan-stats-line">
            <span>${t('clan.members.n', { n: clan.members.length })}</span>
            <span>·</span>
            <span>${t('clan.xp.total', { xp: clan.totalXp || 0 })}</span>
            <span>·</span>
            <span>${emojiIcon('📀')}${t('clan.coins.yours', { n: userData.clanCoins || 0 })}</span>
          </div>
          <div class="clan-code-line">
            ${t('clan.code.label')} <b id="clanCodeVal">${clan.code}</b>
            <button class="rpg-panel-btn" id="clanCopyBtn" type="button">${t('clan.copy')}</button>
          </div>
        </div>
      </section>

      <section class="rpg-panel">
        <h3 class="rpg-panel-title">${t('clan.members')}</h3>
        <div class="clan-members" id="clanMembers"></div>
      </section>

      <section class="rpg-panel clan-chat">
        <h3 class="rpg-panel-title">${t('chat.title')}</h3>
        <div class="chat-box" id="chatBox">
          <p class="inv-empty">${t('msn.loading')}</p>
        </div>
        <div class="chat-input-row">
          <button class="chat-attach" id="chatAttachBtn" type="button" title="${t('chat.attach')}">${emojiIcon('📷')}</button>
          <input class="rpg-input chat-input" id="chatInput" maxlength="500" placeholder="${t('chat.ph')}">
          <button class="rpg-panel-btn rpg-panel-btn--gold chat-send" id="chatSendBtn" type="button">${t('chat.send')}</button>
          <input type="file" id="chatFileIn" accept="image/*" style="display:none;">
        </div>
      </section>

      <section class="rpg-panel">
        <h3 class="rpg-panel-title">${t('clanshop.title')}</h3>
        <p class="clanshop-sub">${t('clanshop.sub')}</p>
        <div class="clanshop-grid" id="clanShopGrid"></div>
      </section>

      <div class="clan-actions">
        <button class="rpg-panel-btn rpg-panel-btn--gold" id="clanMissionsBtn" type="button">${t('clan.missions.btn')}</button>
        <button class="rpg-panel-btn clan-leave" id="clanLeaveBtn" type="button">
          ${isOwner && clan.members.length > 1 ? t('clan.leave.owner') : isOwner ? t('clan.dissolve') : t('clan.leave')}
        </button>
      </div>
    </div>
  `;

  const membersEl = page.querySelector('#clanMembers');
  clan.members.forEach(uid => {
    const row = document.createElement('div');
    row.className = 'clan-member';
    row.innerHTML = `
      <span class="clan-member-name">${escapeHtml(clan.memberNames?.[uid] || 'Erou')}</span>
      ${uid === clan.ownerUid ? `<span class="clan-owner-badge">${t('clan.leader')}</span>` : ''}
      ${uid === currentUser.uid ? `<span class="clan-you-badge">${t('clan.you')}</span>` : ''}
    `;
    membersEl.appendChild(row);
  });

  // Clan shop — buffs for every member
  const shopGrid = page.querySelector('#clanShopGrid');
  CLAN_SHOP.forEach(def => {
    const active = _clanBuffs[def.key] && _clanBuffs[def.key] >= todayKey();
    const coins  = userData.clanCoins || 0;
    const card   = document.createElement('div');
    card.className = 'clanshop-card' + (active ? ' clanshop-card--active' : '');
    card.innerHTML = `
      <span class="clanshop-ic">${emojiIcon(def.icon)}</span>
      <div class="clanshop-txt">
        <div class="clanshop-name">${t('clanbuff.' + def.key + '.name')}</div>
        <div class="clanshop-desc">${t('clanbuff.' + def.key + '.desc')}</div>
        ${active ? `<div class="clanshop-active">${t('clanshop.active', { d: _clanBuffs[def.key] })}</div>` : ''}
      </div>
      <div class="clanshop-side">
        <span class="clanshop-cost">${def.cost} ${emojiIcon('📀')}</span>
        <button class="rpg-panel-btn${coins >= def.cost ? ' rpg-panel-btn--gold' : ''}" type="button"
                ${coins < def.cost ? 'disabled' : ''}
                title="${coins < def.cost ? t('clanshop.poor') : ''}">${t('shop2.buy')}</button>
      </div>
    `;
    const btn = card.querySelector('button');
    if (coins >= def.cost) btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const expiry = await buyClanBuff(clan.id, def.key, def.days, todayKey());
        userData.clanCoins = (userData.clanCoins || 0) - def.cost;
        await saveUserData(currentUser.uid, { clanCoins: userData.clanCoins });
        _clanBuffs = { ..._clanBuffs, [def.key]: expiry };
        playSfx('buy');
        confettiBurst();
        showToast(t('clanshop.bought'));
        renderClanPage();
      } catch (err) {
        showToast(err.message || t('clan.leave.fail'));
        btn.disabled = false;
      }
    });
    shopGrid.appendChild(card);
  });

  initClanChat(page, clan);

  page.querySelector('#clanCopyBtn').addEventListener('click', () => {
    navigator.clipboard?.writeText(clan.code).then(
      () => showToast(t('clan.copied')),
      () => showToast(t('clan.code.show', { code: clan.code }))
    );
  });
  page.querySelector('#clanMissionsBtn').addEventListener('click', () => navigateTo('missionsPage'));
  page.querySelector('#clanLeaveBtn').addEventListener('click', async (e) => {
    if (!(await askConfirm(t('clan.leave.confirm'), t('confirm.ok'), t('confirm.cancel')))) return;
    e.target.disabled = true;
    try {
      await leaveClan(currentUser.uid, clan);
      userData.clanId  = null;
      userData.clanTag = null;
      await saveUserData(currentUser.uid, { clanId: null, clanTag: null });
      refreshHUD();
      showToast(t('clan.leave.done'));
      renderClanPage();
    } catch (err) {
      showToast(t('clan.leave.fail'));
      e.target.disabled = false;
    }
  });
}

// ── Public clan list (no-clan view) ───────────────────────────────────────────
async function loadClanList(page) {
  const el = page.querySelector('#clanListEl');
  if (!el) return;

  let clans = [];
  try { clans = await listClans(20); } catch (err) { console.error('[clanList]', err); }

  if (clans.length === 0) {
    el.innerHTML = `<p class="inv-empty">${t('clan.list.empty')}</p>`;
    return;
  }

  el.innerHTML = '';
  clans.forEach((clan, i) => {
    const full = clan.members.length >= 20;
    const row  = document.createElement('div');
    row.className = 'clan-list-row';
    row.innerHTML = `
      <span class="clan-list-rank">#${i + 1}</span>
      <span class="clan-list-emblem">${emojiIcon(clan.emblem || '🛡️')}</span>
      <div class="clan-list-info">
        <div class="clan-list-name">${escapeHtml(clan.name)} <span class="clan-tag">[${escapeHtml(clan.tag)}]</span></div>
        <div class="clan-list-meta">${t('clan.list.meta', { m: clan.members.length, xp: clan.totalXp || 0 })}</div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'rpg-panel-btn' + (full ? '' : ' rpg-panel-btn--gold');
    btn.textContent = full ? t('clan.full') : t('clan.join.btn');
    btn.disabled    = full;
    if (!full) btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const joined = await joinClanById(currentUser.uid, userData.displayName, clan.id);
        userData.clanId  = joined.id;
        userData.clanTag = joined.tag;
        await saveUserData(currentUser.uid, { clanId: joined.id, clanTag: joined.tag });
        refreshHUD();
        showToast(t('clan.welcome', { name: joined.name }));
        confettiBurst();
        renderClanPage();
      } catch (err) {
        showToast(err.message || t('clan.join.fail'));
        btn.disabled = false;
      }
    });
    row.appendChild(btn);
    el.appendChild(row);
  });
}

// ── Battle player sprite = the player's avatar ────────────────────────────────
function setBattlePlayerSprite() {
  const slot = document.querySelector('.poke-slot--player');
  if (!slot) return;
  const old = document.getElementById('playerSprite');
  const av  = userData?.avatar;

  let el;
  if (av && isImageAvatar(av)) {
    el = document.createElement('img');
    el.src = av;
    el.alt = '';
    el.classList.add('poke-sprite--avatar');
  } else if (av) {
    el = document.createElement('span');
    el.className = 'poke-sprite--emoji';
    el.textContent = av;
  } else {
    el = document.createElement('img');       // no avatar chosen → default art
    el.src = 'assets/Student.png';
    el.alt = 'Player';
  }
  el.id = 'playerSprite';
  el.classList.add('poke-sprite');
  if (old) old.replaceWith(el); else slot.appendChild(el);
}

// ── Battle items & buffs ──────────────────────────────────────────────────────
function renderConsumableBar({ enabled = true } = {}) {
  const bar = document.getElementById('powerUpBar');
  if (!bar) return;

  const inventory   = userData?.inventory || [];
  const ownedActive = ACTIVE_CONSUMABLES.filter(id => inventory.includes(id));

  if (ownedActive.length === 0) { bar.style.display = 'none'; return; }

  bar.style.display = '';
  bar.innerHTML = '';
  ownedActive.forEach(id => {
    const p        = POWERUP_MAP[id];
    const used     = battleManager && battleManager.consumables[id] === false;
    const disabled = !enabled || used;

    const btn        = document.createElement('button');
    btn.type         = 'button';
    btn.className    = `pup-btn pup-consumable${used ? ' pup-used' : ''}`;
    btn.dataset.item = id;
    btn.title        = `${p.name} — ${p.tooltip}`;
    btn.disabled     = disabled;
    btn.innerHTML    = `<span class="pup-icon">${emojiIcon(p.icon)}</span>`;
    if (!disabled) btn.addEventListener('click', () => handleConsumableUse(id));
    bar.appendChild(btn);
  });
}

function renderPersistentPanel() {
  const panel = document.getElementById('persistentBuffPanel');
  if (!panel) return;

  const inventory = userData?.inventory || [];
  const owned     = [
    ...PERSISTENT_ITEMS.filter(id => inventory.includes(id)),
    ...PASSIVE_CONSUMABLES.filter(id => inventory.includes(id)),
  ];

  if (owned.length === 0) { panel.style.display = 'none'; return; }

  panel.style.display = '';
  panel.innerHTML = owned.map(id => {
    const p     = POWERUP_MAP[id];
    const spent = (id === 'shield'       && battleManager && !battleManager.shieldActive)
               || (id === 'mirror_shard' && battleManager && !battleManager.mirrorActive);
    return `<span class="buff-pill${spent ? ' buff-pill--spent' : ''}" title="${p.tooltip}">
      ${emojiIcon(p.icon)} ${p.name}${spent ? ' ✗' : ''}
    </span>`;
  }).join('');
}

function handleConsumableUse(itemId) {
  if (!battleManager) return;
  const p = POWERUP_MAP[itemId];
  if (!p || typeof p.action !== 'function') return;

  p.action(battleManager, {
    showToast,
    updateHpDisplay() {
      const pct  = (battleManager.playerHP / battleManager.playerMax) * 100;
      const fill = document.getElementById('playerHpFill');
      const text = document.getElementById('playerHpText');
      if (fill) fill.style.width = Math.min(100, pct) + '%';
      if (text) text.textContent = `${battleManager.playerHP}/${battleManager.playerMax}`;
    },
    rerenderBar() {
      renderConsumableBar({ enabled: true });
      renderPersistentPanel();
    },
    eliminateAnswer(idx) {
      const btns = document.querySelectorAll('.answer-btn');
      if (btns[idx]) { btns[idx].disabled = true; btns[idx].classList.add('eliminated'); }
    },
  });
}

// ── Battle UI helpers ─────────────────────────────────────────────────────────
function resetBattleUI() {
  document.getElementById('lessonContent').style.display = 'none';
  document.getElementById('questionArea').style.display  = 'none';
  document.getElementById('dialogueBox').style.display   = '';
  document.getElementById('enemyHpFill').style.width     = '100%';
  document.getElementById('playerHpFill').style.width    = '100%';
  document.getElementById('enemyHpText').textContent     = '100/100';
  document.getElementById('playerHpText').textContent    = '100/100';
  const pupBar  = document.getElementById('powerUpBar');
  const pupHint = document.getElementById('powerUpHint');
  const buffPnl = document.getElementById('persistentBuffPanel');
  if (pupBar)  pupBar.style.display  = 'none';
  if (pupHint) pupHint.style.display = 'none';
  if (buffPnl) buffPnl.style.display = 'none';
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