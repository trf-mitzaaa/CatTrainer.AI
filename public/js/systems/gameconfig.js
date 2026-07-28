// ~~~~~~~~~~~~~~~~~~~~
// CONFIGURĂRI!! configurări diverse pentru funcționarea site-ului.
// ~~~~~~~~~~~~~~~~~~~~

import { db } from '../core/firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { SUBJECTS } from '../game.js';
import { registerCustomPowerups } from './powerups.js';

// modelele permise pentru generarea întrebărilor (adminul alege din panou)
export const AI_MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6'];

export const DEFAULT_BATTLE_CONFIG = {
  enemyHp:  100,
  bossHp:   150,
  playerHp: 100,
  aiModel:  'claude-haiku-4-5',
};

let _battle        = { ...DEFAULT_BATTLE_CONFIG };
let _levelsApplied = false;

export function getBattleConfig() { return _battle; }

export async function loadGameConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'battle'));
    if (snap.exists()) {
      const d = snap.data();
      _battle = {
        enemyHp:  Math.max(10, Number(d.enemyHp)  || DEFAULT_BATTLE_CONFIG.enemyHp),
        bossHp:   Math.max(10, Number(d.bossHp)   || DEFAULT_BATTLE_CONFIG.bossHp),
        playerHp: Math.max(10, Number(d.playerHp) || DEFAULT_BATTLE_CONFIG.playerHp),
        // dacă în baza de date e un model necunoscut, rămânem pe cel implicit
        aiModel:  AI_MODELS.includes(d.aiModel) ? d.aiModel : DEFAULT_BATTLE_CONFIG.aiModel,
      };
    }
  } catch (err) {
    console.warn('[gameconfig] config/battle indisponibil — valori implicite.', err);
  }

  // pentru nivelele adăugate de către un admin
  if (!_levelsApplied) {
    try {
      const snap = await getDoc(doc(db, 'config', 'customLevels'));
      if (snap.exists()) {
        const data = snap.data();
        SUBJECTS.forEach(subject => {
          const extra = data[subject.key];
          if (!Array.isArray(extra)) return;
          extra.forEach(lvl => {
            if (!lvl || !lvl.title || !lvl.topic) return;
            subject.levels.push({
              type:     ['lesson', 'enemy', 'boss'].includes(lvl.type) ? lvl.type : 'enemy',
              title:    String(lvl.title),
              icon:     lvl.icon || '⚔️',
              topic:    String(lvl.topic),
              enemy:    lvl.enemy ? String(lvl.enemy) : undefined,
              __custom: true,
            });
          });
        });
      }
      _levelsApplied = true;
    } catch (err) {
      console.warn('[gameconfig] config/customLevels indisponibil.', err);
    }
  }

  // pentru itemele adăugate de către un admin
  try {
    const snap = await getDoc(doc(db, 'config', 'customShop'));
    if (snap.exists()) registerCustomPowerups(snap.data().items || []);
  } catch (err) {
    console.warn('[gameconfig] config/customShop indisponibil.', err);
  }

  return _battle;
}