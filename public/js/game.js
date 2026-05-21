import { BIOLOGY }         from './levels/biology.js';
import { t } from './i18n.js';
import { MATH }            from './levels/math.js';
import { HISTORY }         from './levels/history.js';
import { CHEMISTRY }       from './levels/chemistry.js';
import { PHYSICS }         from './levels/physics.js';
import { LITERATURE }      from './levels/literature.js';
import { COMPUTERSCIENCE } from './levels/computerscience.js';

// ── Subject registry — order controls World Map display order ─────────────────
export const SUBJECTS = [
  BIOLOGY,
  MATH,
  HISTORY,
  CHEMISTRY,
  PHYSICS,
  LITERATURE,
  COMPUTERSCIENCE,
];

// ── Lookups ───────────────────────────────────────────────────────────────────
export function getSubject(key) {
  return SUBJECTS.find(s => s.key === key) || null;
}

export function getLevel(subjectKey, levelIndex) {
  const subject = getSubject(subjectKey);
  if (!subject) return null;
  return subject.levels[levelIndex] || null;
}

// Index of the first level the player hasn't completed yet
export function getNextLevelIndex(subjectKey, completedLevels = []) {
  const subject = getSubject(subjectKey);
  if (!subject) return 0;
  for (let i = 0; i < subject.levels.length; i++) {
    if (!completedLevels.includes(i)) return i;
  }
  return subject.levels.length; // all done
}

// ── Shop Items ────────────────────────────────────────────────────────────────
export function getShopItems() {
  return [
    { id: 'hp_potion',      name: t('shop.item.hp_potion.name'),      icon: '🧪', desc: t('shop.item.hp_potion.desc'),      price: 50,  effect: { hp: 30 } },
    { id: 'xp_boost',       name: t('shop.item.xp_boost.name'),       icon: '📜', desc: t('shop.item.xp_boost.desc'),       price: 80,  effect: { xpMult: 1.5 } },
    { id: 'hint_stone',     name: t('shop.item.hint_stone.name'),     icon: '💎', desc: t('shop.item.hint_stone.desc'),     price: 60,  effect: { hints: 1 } },
    { id: 'cat_charm',      name: t('shop.item.cat_charm.name'),      icon: '🐱', desc: t('shop.item.cat_charm.desc'),      price: 120, effect: { luck: true } },
    { id: 'time_hourglass', name: t('shop.item.time_hourglass.name'), icon: '⏳', desc: t('shop.item.time_hourglass.desc'), price: 70,  effect: { extraTime: 15 } },
    { id: 'shield',         name: t('shop.item.shield.name'),         icon: '🛡️', desc: t('shop.item.shield.desc'),         price: 100, effect: { shield: 1 } },
  ];
}
// Keep SHOP_ITEMS as a getter-backed const for backwards compat
export const SHOP_ITEMS = getShopItems();

// ── Achievements ──────────────────────────────────────────────────────────────
export function getAchievements() {
  return [
    { id: 'first_lesson', name: t('ach.first_lesson.name'), icon: '👣', desc: t('ach.first_lesson.desc') },
    { id: 'first_win',    name: t('ach.first_win.name'),    icon: '⚔️', desc: t('ach.first_win.desc') },
    { id: 'first_boss',   name: t('ach.first_boss.name'),   icon: '🐉', desc: t('ach.first_boss.desc') },
    { id: 'level10',      name: t('ach.level10.name'),      icon: '🎓', desc: t('ach.level10.desc') },
    { id: 'gold100',      name: t('ach.gold100.name'),      icon: '💰', desc: t('ach.gold100.desc') },
    { id: 'streak3',      name: t('ach.streak3.name'),      icon: '🔥', desc: t('ach.streak3.desc') },
    { id: 'realm_done',   name: t('ach.realm_done.name'),   icon: '👑', desc: t('ach.realm_done.desc') },
    { id: 'all_realms',   name: t('ach.all_realms.name'),   icon: '🌟', desc: t('ach.all_realms.desc') },
  ];
}
export const ACHIEVEMENTS = getAchievements();

// ── Hero class / badge by level ───────────────────────────────────────────────
export function getHeroClass(level) {
  if (level >= 50) return t('hero.class.50');
  if (level >= 30) return t('hero.class.30');
  if (level >= 20) return t('hero.class.20');
  if (level >= 10) return t('hero.class.10');
  if (level >= 5)  return t('hero.class.5');
  return t('hero.class.0');
}

export function getHeroBadge(level) {
  if (level >= 50) return t('hero.badge.50');
  if (level >= 30) return t('hero.badge.30');
  if (level >= 20) return t('hero.badge.20');
  if (level >= 10) return t('hero.badge.10');
  if (level >= 5)  return t('hero.badge.5');
  return t('hero.badge.0');
}

// ── XP needed for next level ──────────────────────────────────────────────────
export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.25, level - 1));
}

// ── Rewards per level type ────────────────────────────────────────────────────
export function getReward(levelType) {
  switch (levelType) {
    case 'lesson': return { xp: 20,  gold: 0  };
    case 'enemy':  return { xp: 40,  gold: 25 };
    case 'boss':   return { xp: 100, gold: 75 };
    default:       return { xp: 20,  gold: 0  };
  }
}

// ── GM Dialogues — kept for backwards compat, prefer t() from i18n.js ──────
// @deprecated use t('gm.welcome') etc. via i18n.js instead
export const GM_DIALOGUES = {
  welcome: [
    'Miau! Bine ai venit în tărâmul meu, tânăr învățăcel! 🐱',
    'Purrr... Ești gata să înveți?',
    'Pisica înțeleaptă știe: cunoașterea este cea mai mare comoară! ✨',
  ],
  lesson: [
    'E timpul să studiezi, tinere! Absoarbe aceste rune străvechi... 📜',
    'Chiar și o pisică știe să observe înainte să sară! Citește cu atenție... 👁️',
    'Miau! Această cunoaștere îți va fi de folos în bătălie! 🐾',
  ],
  battle: [
    'Un provocator se apropie! Arată ce știi! ⚔️',
    'Hiss! Dovedește-ți valoarea, învățăcelule! 😼',
    'Luptă cu mintea, nu cu ghearele! 🧠',
  ],
  correct: [
    'Purrfect! Exact corect! 🐱✨',
    'Nyaa~! Răspuns strălucit! 💫',
    'Da! Cunoașterea curge prin tine! ⚡',
  ],
  wrong: [
    'Hiss... Asta a fost greșit, tinere. 😾',
    'Miau... Studiază mai mult! Fiecare greșeală este o lecție. 📚',
    'Nu chiar... Amintește-ți ce spun pergamentele! 🔮',
  ],
  victory: [
    'URLETUL VICTORIEI! Ai învins inamicul! 🎉',
    'Purrr! Știam că poți, învățăcelule! 🌟',
    'Magnific! Tărâmul se înclină în fața înțelepciunii tale! 👑',
  ],
  defeat: [
    'Miau... Ai fost învins. Dar un adevărat învățăcel nu renunță niciodată! 🐾',
    'Chiar și pisicile mai cad uneori. Ridică-te și studiază din nou! 😿',
    'Inamicul a fost puternic, dar cunoașterea crește cu fiecare bătălie! 📖',
  ],
  boss_warn: [
    'AI GRIJĂ! Un boss înfricoșător te așteaptă mai departe! Pregătește-te! ⚠️',
    '*hiss* Acesta nu este un adversar obișnuit! Studiază bine înainte! 🔥',
    'Gardianul final este aproape... Pune-ți la încercare toată cunoașterea! 🐉',
  ],
};

export function randomDialogue(key) {
  const arr = GM_DIALOGUES[key] || GM_DIALOGUES.welcome;
  return arr[Math.floor(Math.random() * arr.length)];
}