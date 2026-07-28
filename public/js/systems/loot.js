// ~~~~~~~~~~~~~~~~~~~~
// LOOT!! iubim atunci când primim ceva, nu-i așa?
// acest script ține toate valorile pentru loot-ul care poate pica.
// ~~~~~~~~~~~~~~~~~~~~

import { db } from '../core/firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { EQUIPMENT, getEquipmentByRarity } from './equipment.js';
import { POWERUPS } from './powerups.js';

// ~~~~~~~~~~ configurație DEFAULT ~~~~~~~~~~
export const DEFAULT_LOOT_CONFIG = {
  // șansele sunt de la 0 la 1.
  dropChance: {
    enemy: 0.35,
    boss:  1.0,
  },
  // șansele sunt de la 0 la 100.
  chestWeights: {
    common: 70,
    rare:   25,
    epic:   5,
  },
  // ce conține fiecare chest
  chestLoot: {
    common: { equipment: 30, consumable: 55, gold: 15 },
    rare:   { equipment: 55, consumable: 35, gold: 10 },
    epic:   { equipment: 80, consumable: 15, gold: 5  },
  },
  // cât gold primește utilizatorul dacă i-a picat gold.
  goldAmounts: {
    common: 40,
    rare:   90,
    epic:   200,
  },
  // prețuri pentru chest-uri la shop.
  chestPrices: {
    common: 250,
    rare:   600,
    epic:   1500,
  },
};

export const CHEST_META = {
  common: { icon: '🧰', name: 'Cufăr Comun',  color: '#9aa5b1' },
  rare:   { icon: '🎁', name: 'Cufăr Rar',    color: '#4da3ff' },
  epic:   { icon: '👝', name: 'Cufăr Epic',   color: '#b45cff' },
};

let _config = structuredClone(DEFAULT_LOOT_CONFIG);

export function getLootConfig() { return _config; }

export async function loadLootConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'loot'));
    if (snap.exists()) {
      _config = deepMerge(structuredClone(DEFAULT_LOOT_CONFIG), snap.data());
    }
  } catch (err) {
    console.warn('[loot] Nu s-a putut încărca config-ul, folosesc valorile implicite.', err);
  }
  return _config;
}

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

function weightedPick(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total   = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function rollChestDrop(levelType) {
  if (levelType !== 'enemy' && levelType !== 'boss') return null;
  const chance = _config.dropChance[levelType] ?? 0;
  if (Math.random() >= chance) return null;
  return weightedPick(_config.chestWeights);
}

export function openChestRoll(tier) {
  const lootTable = _config.chestLoot[tier] || _config.chestLoot.common;
  const category  = weightedPick(lootTable) || 'gold';

  if (category === 'equipment') {
    const pools = {
      common: getEquipmentByRarity('common'),
      rare:   [...getEquipmentByRarity('common'), ...getEquipmentByRarity('rare')],
      epic:   [...getEquipmentByRarity('rare'),   ...getEquipmentByRarity('epic')],
    };
    const pool = pools[tier]?.length ? pools[tier] : EQUIPMENT;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return { type: 'equipment', id: item.id, item };
  }

  if (category === 'consumable') {
    const items = POWERUPS.filter(p => p.type === 'consumable');
    const item  = items[Math.floor(Math.random() * items.length)];
    return { type: 'consumable', id: item.id, item };
  }

  return { type: 'gold', amount: _config.goldAmounts[tier] ?? 50 };
}