// ~~~~~~~~~~~~~~~~~~~~
// ECHIPAMENT!!! orice RPG are și un sistem de echipamente, nu?
// utilizatorii pot obține echipament din chesturi
// ~~~~~~~~~~~~~~~~~~~~

export const MAX_EQUIPPED = 3;

export const EQUIPMENT = [

  // ~~~~~~~~~~ COMMON ~~~~~~~~~~
  {
    id:       'copper_ring',
    icon:     '💍',
    name:     'Inelul de Cupru',
    rarity:   'common',
    desc:     '+5% aur din lupte',
    xpMult:   0,
    goldMult: 0.05,
  },
  {
    id:       'scholar_quill',
    icon:     '🪶',
    name:     'Pana Învățatului',
    rarity:   'common',
    desc:     '+5% XP din lupte',
    xpMult:   0.05,
    goldMult: 0,
  },
  {
    id:       'lucky_bell',
    icon:     '🔔',
    name:     'Clopoțelul Norocos',
    rarity:   'common',
    desc:     '+3% XP și +3% aur',
    xpMult:   0.03,
    goldMult: 0.03,
  },

  // ~~~~~~~~~~ RARE ~~~~~~~~~~
  {
    id:       'gold_amulet',
    icon:     '🧿',
    name:     'Amuleta Aurie',
    rarity:   'rare',
    desc:     '+10% aur din lupte',
    xpMult:   0,
    goldMult: 0.10,
  },
  {
    id:       'wise_tome',
    icon:     '📕',
    name:     'Tomul Înțelepciunii',
    rarity:   'rare',
    desc:     '+10% XP din lupte',
    xpMult:   0.10,
    goldMult: 0,
  },
  {
    id:       'merchant_gloves',
    icon:     '🧤',
    name:     'Mănușile Negustorului',
    rarity:   'rare',
    desc:     '+8% aur și +4% XP',
    xpMult:   0.04,
    goldMult: 0.08,
  },

  // ~~~~~~~~~~ EPIC ~~~~~~~~~~
  {
    id:       'kings_crown',
    icon:     '👑',
    name:     'Coroana Regelui Pisicilor',
    rarity:   'epic',
    desc:     '+15% aur și +10% XP',
    xpMult:   0.10,
    goldMult: 0.15,
  },
  {
    id:       'dragon_charm',
    icon:     '🐲',
    name:     'Talismanul Dragonului',
    rarity:   'epic',
    desc:     '+15% XP din lupte',
    xpMult:   0.15,
    goldMult: 0,
  },
  {
    id:       'midas_paw',
    icon:     '🐾',
    name:     'Laba lui Midas',
    rarity:   'epic',
    desc:     '+20% aur din lupte',
    xpMult:   0,
    goldMult: 0.20,
  },

];

// ~~~~~~~~~~ metodă pentru a căuta echipamentele
export const EQUIPMENT_MAP = Object.fromEntries(EQUIPMENT.map(e => [e.id, e]));

export function getEquipmentByRarity(rarity) {
  return EQUIPMENT.filter(e => e.rarity === rarity);
}

export function getEquipmentBonuses(equippedIds = []) {
  let xp = 0, gold = 0;
  equippedIds.forEach(id => {
    const e = EQUIPMENT_MAP[id];
    if (!e) return;
    xp   += e.xpMult   || 0;
    gold += e.goldMult || 0;
  });
  return { xpMult: 1 + xp, goldMult: 1 + gold };
}

export const RARITY_META = {
  common: { label: 'Comun',  color: '#9aa5b1' },
  rare:   { label: 'Rar',    color: '#4da3ff' },
  epic:   { label: 'Epic',   color: '#b45cff' },
};
