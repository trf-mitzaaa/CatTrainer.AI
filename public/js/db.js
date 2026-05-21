import { db } from './firebase-config.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Imported lazily to avoid a circular dependency at module load time.
// onboarding.js → db.js would be circular; using a setter call instead.
let _setProfileCache = null;
export function registerProfileSetter(fn) { _setProfileCache = fn; }

// ── XP formula ────────────────────────────────────────────────────────────────
export function getXPNeeded(level) {
  return Math.floor(100 * Math.pow(1.25, level - 1));
}

// ── Default user document ─────────────────────────────────────────────────────
function defaultUserData(user) {
  return {
    uid:              user.uid,
    displayName:      user.displayName || 'Erou',
    email:            user.email       || '',
    level:            1,
    xp:               0,
    gold:             0,
    hp:               100,
    maxHp:            100,
    battlesWon:       0,
    lessonsCompleted: 0,
    streak:           0,
    lastActivity:     serverTimestamp(),
    realmProgress:    {},
    inventory:        [],
    achievements:     [],
    profile:          null,   // filled by onboarding
    createdAt:        serverTimestamp(),
  };
}

// ── Init user on first login ──────────────────────────────────────────────────
export async function initUserData(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, defaultUserData(user));
  }
}

// ── Load user data ────────────────────────────────────────────────────────────
export async function loadUserData(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();

  // Restore onboarding profile into in-memory cache so battle.js can use it
  if (data.profile && _setProfileCache) {
    _setProfileCache(data.profile);
  }

  return data;
}

// ── Generic field update ──────────────────────────────────────────────────────
export async function saveUserData(uid, updates) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    ...updates,
    lastActivity: serverTimestamp(),
  });
}

// ── Complete a level ──────────────────────────────────────────────────────────
export async function completeLevel(uid, subjectKey, levelIndex, xpGained, goldGained) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('User data not found');

  const data     = snap.data();
  const progress = data.realmProgress || {};

  if (!progress[subjectKey]) {
    progress[subjectKey] = { completedLevels: [], currentLevel: 0 };
  }

  // Add to completed list (idempotent)
  if (!progress[subjectKey].completedLevels.includes(levelIndex)) {
    progress[subjectKey].completedLevels.push(levelIndex);
  }
  progress[subjectKey].currentLevel = Math.max(
      progress[subjectKey].currentLevel || 0,
      levelIndex + 1
  );

  // Level-up calculation
  let newXp    = (data.xp    || 0) + xpGained;
  let newLevel = (data.level || 1);
  while (newXp >= getXPNeeded(newLevel)) {
    newXp -= getXPNeeded(newLevel);
    newLevel++;
  }
  const newGold = (data.gold || 0) + goldGained;

  const isLesson   = levelIndex === 0;  // first node is always the lesson
  const newBattles = isLesson ? (data.battlesWon       || 0)     : (data.battlesWon       || 0) + 1;
  const newLessons = isLesson ? (data.lessonsCompleted || 0) + 1 : (data.lessonsCompleted || 0);

  await updateDoc(ref, {
    realmProgress:    progress,
    xp:               newXp,
    gold:             newGold,
    level:            newLevel,
    battlesWon:       newBattles,
    lessonsCompleted: newLessons,
    lastActivity:     serverTimestamp(),
  });

  return { newXp, newGold, newLevel, progress };
}

// ── Buy shop item ─────────────────────────────────────────────────────────────
export async function buyItem(uid, item, currentGold) {
  if (currentGold < item.price) return false;

  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    gold:         currentGold - item.price,
    inventory:    arrayUnion(item.id),
    lastActivity: serverTimestamp(),
  });
  return true;
}

// ── Grant achievement (idempotent) ────────────────────────────────────────────
export async function grantAchievement(uid, achievementId) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;

  const data = snap.data();
  if ((data.achievements || []).includes(achievementId)) return false;

  await updateDoc(ref, {
    achievements: arrayUnion(achievementId),
    lastActivity: serverTimestamp(),
  });
  return true;
}