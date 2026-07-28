// ~~~~~~~~~~~~~~~~~~~~
// PAGINĂ DE ADMIN!! o pagină care permite admin-ului să modifice conținutul platformei
// ~~~~~~~~~~~~~~~~~~~~

// js/admin.js
// ─────────────────────────────────────────────────────────────────────────────
//  CatTrainer RPG — Admin panel for loot configuration (admin.html)
//
//  SELF-CONTAINED on purpose: imports ONLY js/firebase-config.js + Firebase CDN.
//  It does not touch the game's modules, so a partial game deploy can never
//  break this page.
//
//  SETUP: add your Firebase UID to ADMIN_UIDS below (it's shown on the page
//  after you log in), or put it in the Firestore doc  config/admins  →
//  field "uids" (array) — that way you never need to redeploy this file.
//
//  Saving writes  config/loot , read by the game at startup (js/loot.js).
// ─────────────────────────────────────────────────────────────────────────────

import { auth, db } from './core/firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, limit, arrayRemove, deleteField } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Defaults — keep the numbers in sync with js/loot.js if you change them there.
const DEFAULT_LOOT_CONFIG = {
  dropChance:   { enemy: 0.35, boss: 1.0 },
  chestWeights: { common: 70, rare: 25, epic: 5 },
  chestLoot: {
    common: { equipment: 30, consumable: 55, gold: 15 },
    rare:   { equipment: 55, consumable: 35, gold: 10 },
    epic:   { equipment: 80, consumable: 15, gold: 5  },
  },
  goldAmounts: { common: 40, rare: 90, epic: 200 },
  chestPrices: { common: 250, rare: 600, epic: 1500 },
};

// ─────────────────────────────────────────────────────────────────────────────
//  REAL SECURITY NOTE — the UI gate below is convenience only. Enforce writes
//  in Firestore Rules, otherwise any logged-in user could write config/loot
//  from the browser console:
//
//    match /config/admins {
//      allow read: if request.auth != null;
//      allow write: if false;   // edit only from the Firebase console
//    }
//    match /config/{docId} {
//      allow read: if true;
//      allow write: if request.auth != null &&
//        request.auth.uid in get(/databases/$(database)/documents/config/admins).data.uids;
//    }
//
//  Then create config/admins in the Firebase console with your UID in "uids".
// ─────────────────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
      base[k] = deepMerge(base[k] && typeof base[k] === 'object' ? base[k] : {}, over[k]);
    } else if (over[k] !== undefined && over[k] !== null) {
      base[k] = over[k];
    }
  }
  return base;
}

async function loadCfg() {
  const cfg = structuredClone(DEFAULT_LOOT_CONFIG);
  try {
    const snap = await getDoc(doc(db, 'config', 'loot'));
    if (snap.exists()) deepMerge(cfg, snap.data());
  } catch (err) {
    console.warn('[admin] Nu s-a putut citi config/loot — folosesc valorile implicite.', err);
  }
  return cfg;
}

async function isAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, 'config', 'admins'));
    const uids = snap.exists() ? (snap.data().uids || []) : [];
    return uids.includes(uid);
  } catch {
    return false;
  }
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $('gateMsg').textContent     = 'Nu ești autentificat. Loghează-te mai jos:';
    $('gateMsg').className       = 'warn';
    $('loginForm').style.display = 'block';
    $('panel').style.display     = 'none';
    return;
  }

  $('loginForm').style.display = 'none';

  if (!(await isAdmin(user.uid))) {
    $('gateMsg').textContent = 'Acest cont nu este admin.';
    $('gateMsg').className   = 'err';
    return;
  }

  $('gateMsg').textContent = `Salut, ${user.displayName || 'admin'}! Acces permis.`;
  $('gateMsg').className   = 'ok';
  $('panel').style.display = 'block';

  await populateForm();
  $('saveBtn').onclick = saveConfig;

  initPlayerAdmin();
  await initCustomShop();
  await initBattleConfig();
  await initAiStats();
  $('aiStatsRefresh').onclick = initAiStats;
  await initStagesAdmin();
});

// ── Login on this page (same Firebase Auth as the game) ──────────────────────
document.addEventListener('click', async (e) => {
  if (e.target?.id !== 'adminLoginBtn') return;
  const email = $('adminEmail').value.trim();
  const pass  = $('adminPass').value;
  if (!email || !pass) return;
  e.target.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged takes over
  } catch (err) {
    $('gateMsg').textContent = 'Autentificare eșuată: ' + (err.code || err.message);
    $('gateMsg').className   = 'err';
  } finally {
    e.target.disabled = false;
  }
});

// ── Populate form from config ─────────────────────────────────────────────────
async function populateForm() {
  const cfg = await loadCfg();

  $('dropEnemy').value = Math.round((cfg.dropChance.enemy ?? 0) * 100);
  $('dropBoss').value  = Math.round((cfg.dropChance.boss  ?? 0) * 100);

  $('wCommon').value = cfg.chestWeights.common ?? 0;
  $('wRare').value   = cfg.chestWeights.rare   ?? 0;
  $('wEpic').value   = cfg.chestWeights.epic   ?? 0;

  $('cEquip').value = cfg.chestLoot.common.equipment  ?? 0;
  $('cCons').value  = cfg.chestLoot.common.consumable ?? 0;
  $('cGold').value  = cfg.chestLoot.common.gold       ?? 0;

  $('rEquip').value = cfg.chestLoot.rare.equipment  ?? 0;
  $('rCons').value  = cfg.chestLoot.rare.consumable ?? 0;
  $('rGold').value  = cfg.chestLoot.rare.gold       ?? 0;

  $('eEquip').value = cfg.chestLoot.epic.equipment  ?? 0;
  $('eCons').value  = cfg.chestLoot.epic.consumable ?? 0;
  $('eGold').value  = cfg.chestLoot.epic.gold       ?? 0;

  $('gCommon').value = cfg.goldAmounts.common ?? 0;
  $('gRare').value   = cfg.goldAmounts.rare   ?? 0;
  $('gEpic').value   = cfg.goldAmounts.epic   ?? 0;
  $('cpCommon').value = cfg.chestPrices?.common ?? 250;
  $('cpRare').value   = cfg.chestPrices?.rare   ?? 600;
  $('cpEpic').value   = cfg.chestPrices?.epic   ?? 1500;
}

// ── Save to Firestore ─────────────────────────────────────────────────────────
async function saveConfig() {
  const num = (id) => Math.max(0, Number($(id).value) || 0);

  const cfg = {
    dropChance: {
      enemy: Math.min(100, num('dropEnemy')) / 100,
      boss:  Math.min(100, num('dropBoss'))  / 100,
    },
    chestWeights: {
      common: num('wCommon'),
      rare:   num('wRare'),
      epic:   num('wEpic'),
    },
    chestLoot: {
      common: { equipment: num('cEquip'), consumable: num('cCons'), gold: num('cGold') },
      rare:   { equipment: num('rEquip'), consumable: num('rCons'), gold: num('rGold') },
      epic:   { equipment: num('eEquip'), consumable: num('eCons'), gold: num('eGold') },
    },
    goldAmounts: {
      common: num('gCommon'),
      rare:   num('gRare'),
      epic:   num('gEpic'),
    },
    chestPrices: {
      common: num('cpCommon'),
      rare:   num('cpRare'),
      epic:   num('cpEpic'),
    },
  };

  const btn    = $('saveBtn');
  const status = $('status');
  btn.disabled = true;
  status.textContent = 'Se salvează...';
  status.className   = '';

  try {
    await setDoc(doc(db, 'config', 'loot'), cfg);
    status.textContent = '✓ Salvat! Jucătorii primesc noile șanse la următoarea încărcare a jocului.';
    status.className   = 'ok';
  } catch (err) {
    console.error('[admin]', err);
    status.textContent = '✗ Eroare la salvare: ' + err.message;
    status.className   = 'err';
  } finally {
    btn.disabled = false;
  }
}


// ═════════════════════════════════════════════════════════════════════════════
//  PLAYERS — search / edit / delete
// ═════════════════════════════════════════════════════════════════════════════
let _selectedPlayer = null;

function initPlayerAdmin() {
  $('pSearchBtn').onclick = searchPlayers;
  $('pSaveBtn').onclick   = savePlayer;
  $('pDeleteBtn').onclick = deletePlayer;
}

async function searchPlayers() {
  const q = $('pSearch').value.trim();
  const box = $('pResults');
  if (!q) { box.textContent = 'Scrie un email sau un nume exact.'; return; }
  box.textContent = 'Se caută...';

  try {
    const usersCol = collection(db, 'users');
    const [byEmail, byName] = await Promise.all([
      getDocs(query(usersCol, where('email', '==', q), limit(10))),
      getDocs(query(usersCol, where('displayName', '==', q), limit(10))),
    ]);

    const seen = new Set();
    const results = [];
    [byEmail, byName].forEach(snap => snap.forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      results.push({ id: d.id, ...d.data() });
    }));

    if (results.length === 0) { box.textContent = 'Niciun jucător găsit (căutarea e exactă, nu parțială).'; return; }

    box.innerHTML = '';
    results.forEach(p => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 8px; border:1px solid #4A1A5C; border-radius:4px; margin:4px 0; cursor:pointer;';
      row.textContent = `${p.displayName || '—'}  <${p.email || 'fără email'}>  Lv.${p.level || 1}  ${p.gold || 0} aur`;
      row.onclick = () => selectPlayer(p);
      box.appendChild(row);
    });
  } catch (err) {
    box.textContent = 'Eroare la căutare: ' + err.message;
  }
}

function selectPlayer(p) {
  _selectedPlayer = p;
  $('pEditor').style.display = 'block';
  $('pEditorTitle').textContent = `${p.displayName || '—'} — ${p.id}`;
  $('pGold').value      = p.gold             || 0;
  $('pXp').value        = p.xp               || 0;
  $('pLevel').value     = p.level            || 1;
  $('pBattles').value   = p.battlesWon       || 0;
  $('pLessons').value   = p.lessonsCompleted || 0;
  $('pClanCoins').value = p.clanCoins        || 0;
  $('pStatus').textContent = '';
}

async function savePlayer() {
  if (!_selectedPlayer) return;
  const n = (id) => Math.max(0, Number($(id).value) || 0);
  $('pStatus').textContent = 'Se salvează...';
  $('pStatus').className   = '';
  try {
    await updateDoc(doc(db, 'users', _selectedPlayer.id), {
      gold:             n('pGold'),
      xp:               n('pXp'),
      level:            Math.max(1, n('pLevel')),
      battlesWon:       n('pBattles'),
      lessonsCompleted: n('pLessons'),
      clanCoins:        n('pClanCoins'),
    });
    $('pStatus').textContent = '✓ Salvat.';
    $('pStatus').className   = 'ok';
  } catch (err) {
    $('pStatus').textContent = '✗ ' + err.message;
    $('pStatus').className   = 'err';
  }
}

// scoatem jucătorul din clan înainte să-i ștergem datele
// (logica e copiată din clans.js/leaveClan — admin.js nu importă module din joc)
async function removeFromClan(uid, clanId) {
  if (!clanId) return;
  try {
    const ref  = doc(db, 'clans', clanId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const clan      = snap.data();
    if (!clan.members?.includes(uid)) return;
    const remaining = clan.members.filter(m => m !== uid);

    if (remaining.length === 0) {
      await deleteDoc(ref);                       // ultimul membru → clanul dispare
      return;
    }
    const updates = {
      members: arrayRemove(uid),
      [`memberNames.${uid}`]: deleteField(),
    };
    if (clan.ownerUid === uid) updates.ownerUid = remaining[0];   // liderul trece mai departe
    await updateDoc(ref, updates);
  } catch (err) {
    console.warn('[admin] curățare clan eșuată:', err);
  }
}

async function deletePlayer() {
  if (!_selectedPlayer) return;
  const p = _selectedPlayer;
  if (!confirm(`Ștergi definitiv datele jucătorului "${p.displayName}" (${p.id})?\nProgresul se pierde. Contul de autentificare rămâne — la următorul login primește date noi.`)) return;
  $('pStatus').textContent = 'Se șterge...';
  try {
    await removeFromClan(p.id, p.clanId);
    await deleteDoc(doc(db, 'users', p.id));
    _selectedPlayer = null;
    $('pEditor').style.display = 'none';
    $('pResults').textContent  = 'Jucător șters.';
  } catch (err) {
    $('pStatus').textContent = '✗ ' + err.message;
    $('pStatus').className   = 'err';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  BATTLE CONFIG — enemy / boss / player HP  (config/battle)
// ═════════════════════════════════════════════════════════════════════════════
async function initBattleConfig() {
  const defaults = { enemyHp: 100, bossHp: 150, playerHp: 100 };
  try {
    const snap = await getDoc(doc(db, 'config', 'battle'));
    if (snap.exists()) Object.assign(defaults, snap.data());
  } catch (_) {}
  $('bEnemyHp').value  = defaults.enemyHp;
  $('bBossHp').value   = defaults.bossHp;
  $('bPlayerHp').value = defaults.playerHp;
  $('bAiModel').value  = defaults.aiModel || 'claude-haiku-4-5';

  $('bSaveBtn').onclick = async () => {
    const n = (id) => Math.max(10, Number($(id).value) || 0);
    $('bStatus').textContent = 'Se salvează...';
    $('bStatus').className   = '';
    try {
      await setDoc(doc(db, 'config', 'battle'), {
        aiModel:  $('bAiModel').value,
        enemyHp:  n('bEnemyHp'),
        bossHp:   n('bBossHp'),
        playerHp: n('bPlayerHp'),
      });
      $('bStatus').textContent = '✓ Salvat. Se aplică la următoarea încărcare a jocului.';
      $('bStatus').className   = 'ok';
    } catch (err) {
      $('bStatus').textContent = '✗ ' + err.message;
      $('bStatus').className   = 'err';
    }
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  CUSTOM STAGES — config/customLevels  { subjectKey: [ {type,title,topic,enemy} ] }
// ═════════════════════════════════════════════════════════════════════════════
let _stages = {};

async function initStagesAdmin() {
  try {
    const snap = await getDoc(doc(db, 'config', 'customLevels'));
    _stages = snap.exists() ? snap.data() : {};
  } catch (_) { _stages = {}; }

  $('sSubject').onchange = renderStageList;
  $('sAddBtn').onclick   = addStage;
  renderStageList();
}

function renderStageList() {
  const key  = $('sSubject').value;
  const list = _stages[key] || [];
  const box  = $('sList');
  if (list.length === 0) {
    box.innerHTML = '<em style="opacity:.7">Nicio etapă custom pentru această materie.</em>';
    return;
  }
  box.innerHTML = '';
  list.forEach((lvl, idx) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 8px; border:1px solid #4A1A5C; border-radius:4px; margin:4px 0;';
    row.innerHTML = `<span>[${lvl.type}] ${lvl.title} — <em style="opacity:.7">${lvl.topic}</em></span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Șterge';
    del.style.cssText = 'padding:4px 10px; margin:0; background:#C0392B; color:#F5E6C8; font-size:12px;';
    del.onclick = () => removeStage(key, idx);
    row.appendChild(del);
    box.appendChild(row);
  });
}

async function saveStages(msg) {
  $('sStatus').textContent = 'Se salvează...';
  $('sStatus').className   = '';
  try {
    await setDoc(doc(db, 'config', 'customLevels'), _stages);
    $('sStatus').textContent = '✓ ' + msg;
    $('sStatus').className   = 'ok';
    renderStageList();
  } catch (err) {
    $('sStatus').textContent = '✗ ' + err.message;
    $('sStatus').className   = 'err';
  }
}

async function addStage() {
  const key   = $('sSubject').value;
  const title = $('sTitle').value.trim();
  const topic = $('sTopic').value.trim();
  const enemy = $('sEnemy').value.trim();
  const type  = $('sType').value;
  if (!title || !topic) {
    $('sStatus').textContent = 'Titlul și topicul sunt obligatorii.';
    $('sStatus').className   = 'warn';
    return;
  }
  _stages[key] = _stages[key] || [];
  _stages[key].push({ type, title, topic, ...(enemy ? { enemy } : {}) });
  $('sTitle').value = ''; $('sTopic').value = ''; $('sEnemy').value = '';
  await saveStages('Etapă adăugată. Apare în joc la următoarea încărcare.');
}

async function removeStage(key, idx) {
  if (!confirm('Ștergi această etapă custom? Jucătorii care au completat-o își păstrează progresul pe celelalte nivele.')) return;
  _stages[key].splice(idx, 1);
  await saveStages('Etapă ștearsă.');
}


// ═════════════════════════════════════════════════════════════════════════════
//  CUSTOM SHOP ITEMS  (config/customShop)
//  Each item clones the battle behavior of a base item; only the presentation
//  (name, icon, price, category) is custom. NOTE: the base list below is
//  hard-coded — keep it in sync with js/systems/powerups.js.
// ═════════════════════════════════════════════════════════════════════════════
let _customShop = { items: [] };

async function initCustomShop() {
  try {
    const snap = await getDoc(doc(db, 'config', 'customShop'));
    if (snap.exists()) _customShop = { items: snap.data().items || [] };
  } catch (_) {}

  renderCsList();

  $('csAddBtn').onclick = () => {
    const name  = $('csName').value.trim();
    const icon  = $('csIcon').value.trim() || '✨';
    const price = Math.max(1, Number($('csPrice').value) || 0);
    if (!name || !price) {
      $('csStatus').textContent = 'Numele și prețul sunt obligatorii.';
      $('csStatus').className   = 'warn';
      return;
    }
    _customShop.items.push({
      id:       'custom_' + Date.now().toString(36),
      base:     $('csBase').value,
      name, icon, price,
      category: $('csCat').value,
    });
    $('csName').value = ''; $('csIcon').value = ''; $('csPrice').value = '';
    $('csStatus').textContent = 'Adăugat în listă — apasă „Salvează obiectele" pentru a publica.';
    $('csStatus').className   = 'warn';
    renderCsList();
  };

  $('csSaveBtn').onclick = async () => {
    $('csStatus').textContent = 'Se salvează...';
    $('csStatus').className   = '';
    try {
      await setDoc(doc(db, 'config', 'customShop'), _customShop);
      $('csStatus').textContent = '✓ Salvat. Obiectele apar în magazin la următoarea încărcare a jocului.';
      $('csStatus').className   = 'ok';
    } catch (err) {
      $('csStatus').textContent = '✗ ' + err.message;
      $('csStatus').className   = 'err';
    }
  };
}

function renderCsList() {
  const el = $('csList');
  if (_customShop.items.length === 0) {
    el.innerHTML = '<p style="opacity:.6">Niciun obiect custom.</p>';
    return;
  }
  el.innerHTML = '';
  _customShop.items.forEach((it, i) => {
    const row = document.createElement('label');
    row.innerHTML = `<span>${it.icon} ${it.name} — ${it.price} aur <small>(bază: ${it.base}, cat: ${it.category})</small></span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Șterge';
    btn.style.cssText = 'margin:0; padding:4px 12px; font-size:12px;';
    btn.onclick = () => {
      _customShop.items.splice(i, 1);
      $('csStatus').textContent = 'Șters din listă — salvează pentru a publica.';
      $('csStatus').className   = 'warn';
      renderCsList();
    };
    row.appendChild(btn);
    el.appendChild(row);
  });
}


// ═════════════════════════════════════════════════════════════════════════════
//  STATISTICI AI  (stats/aiUsage — scris de battle.js la fiecare apel)
// ═════════════════════════════════════════════════════════════════════════════
const AI_PRICES = {   // $ per milion de tokeni [input, output]
  'claude-haiku-4-5':  [1, 5],
  'claude-sonnet-4-6': [3, 15],
};

function aiCost(modelKey, inTok, outTok) {
  const p = AI_PRICES[modelKey.replace(/_/g, '-')] || null;
  if (!p) return null;
  return (inTok / 1e6) * p[0] + (outTok / 1e6) * p[1];
}

async function initAiStats() {
  const box = $('aiStatsBox');
  box.innerHTML = '<p style="opacity:.6">Se încarcă...</p>';
  let data = null;
  try {
    const snap = await getDoc(doc(db, 'stats', 'aiUsage'));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    box.innerHTML = `<p class="err">✗ ${err.message} — verifică regula pentru colecția stats.</p>`;
    return;
  }
  if (!data || !data.total) {
    box.innerHTML = '<p style="opacity:.6">Niciun apel AI înregistrat încă.</p>';
    return;
  }

  const t = data.total;
  const totalCost = Object.entries(data.byModel || {}).reduce((sum, [k, v]) => {
    const c = aiCost(k, v.inputTokens || 0, v.outputTokens || 0);
    return c === null ? sum : sum + c;
  }, 0);

  let html = `<p><b>Total:</b> ${t.calls || 0} apeluri ·
    ${(t.inputTokens || 0).toLocaleString()} tokeni intrare ·
    ${(t.outputTokens || 0).toLocaleString()} tokeni ieșire ·
    cost estimat <b>$${totalCost.toFixed(4)}</b></p>`;

  html += '<p><b>Pe model:</b></p>';
  for (const [k, v] of Object.entries(data.byModel || {})) {
    const c = aiCost(k, v.inputTokens || 0, v.outputTokens || 0);
    html += `<label><span>${k.replace(/_/g, '-')} — ${v.calls || 0} apeluri ·
      ${(v.inputTokens || 0).toLocaleString()} in / ${(v.outputTokens || 0).toLocaleString()} out
      ${c === null ? '' : '· $' + c.toFixed(4)}</span></label>`;
  }

  const days = Object.entries(data.byDay || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  if (days.length) {
    html += '<p><b>Ultimele zile:</b></p>';
    for (const [d, v] of days) {
      html += `<label><span>${d} — ${v.calls || 0} apeluri ·
        ${((v.inputTokens || 0) + (v.outputTokens || 0)).toLocaleString()} tokeni</span></label>`;
    }
  }
  box.innerHTML = html;
}