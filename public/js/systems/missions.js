// ~~~~~~~~~~~~~~~~~~~~
// MISIUNI!! fiecare utilizator primește zilnic o serie de misiuni/misiuni de clan (dacă sunt într-un clan)
// după ce acesta le completează, primește o recompensă.
// ~~~~~~~~~~~~~~~~~~~~


export const PLAYER_MISSIONS_PER_DAY = 4;
export const CLAN_MISSIONS_PER_DAY   = 3;

export const PLAYER_MISSION_POOL = [
  { id: 'p_dmg150',  stat: 'damage',  target: 150, icon: '⚔️', name: 'Provoacă 150 damage',            reward: { gold: 60  } },
  { id: 'p_dmg300',  stat: 'damage',  target: 300, icon: '💥', name: 'Provoacă 300 damage',            reward: { gold: 120 } },
  { id: 'p_cor10',   stat: 'correct', target: 10,  icon: '✅', name: 'Răspunde corect la 10 întrebări', reward: { gold: 70  } },
  { id: 'p_cor20',   stat: 'correct', target: 20,  icon: '🧠', name: 'Răspunde corect la 20 întrebări', reward: { gold: 140 } },
  { id: 'p_bat2',    stat: 'battles', target: 2,   icon: '🏆', name: 'Câștigă 2 lupte',                 reward: { gold: 80  } },
  { id: 'p_bat4',    stat: 'battles', target: 4,   icon: '👑', name: 'Câștigă 4 lupte',                 reward: { gold: 160 } },
  { id: 'p_les1',    stat: 'lessons', target: 1,   icon: '📖', name: 'Termină o lecție',                reward: { gold: 50  } },
  { id: 'p_les2',    stat: 'lessons', target: 2,   icon: '📚', name: 'Termină 2 lecții',                reward: { gold: 100 } },
  { id: 'p_chest1',  stat: 'chests',  target: 1,   icon: '🧰', name: 'Deschide un cufăr',               reward: { gold: 40  } },
];

export const CLAN_MISSION_POOL = [
  { id: 'c_dmg1000', stat: 'damage',  target: 1000, icon: '⚔️', name: 'Clan: provocați 1000 damage împreună', reward: { coins: 20 } },
  { id: 'c_dmg2000', stat: 'damage',  target: 2000, icon: '💥', name: 'Clan: provocați 2000 damage împreună', reward: { coins: 35 } },
  { id: 'c_cor50',   stat: 'correct', target: 50,   icon: '✅', name: 'Clan: 50 de răspunsuri corecte',        reward: { coins: 15 } },
  { id: 'c_bat8',    stat: 'battles', target: 8,    icon: '🏆', name: 'Clan: câștigați 8 lupte',               reward: { coins: 20 } },
  { id: 'c_les5',    stat: 'lessons', target: 5,    icon: '📖', name: 'Clan: terminați 5 lecții',              reward: { coins: 15 } },
];

const ALL_MISSIONS = [...PLAYER_MISSION_POOL, ...CLAN_MISSION_POOL];
export const MISSION_MAP = Object.fromEntries(ALL_MISSIONS.map(m => [m.id, m]));

// folosim ceasul local al utilizatorului ca să ne dăm seama când se resetează aceste misiuni
export function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// fiecare utilizator primește aceleași misiuni. (nu știu cum am făcut să meargă asta, dar merge!)
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededPick(pool, count, rng) {
  const copy = [...pool];
  const out  = [];
  while (out.length < count && copy.length > 0) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}
export function getDailyMissions(dateKey = todayKey()) {
  const rngP = mulberry32(hashString(dateKey + ':player'));
  const rngC = mulberry32(hashString(dateKey + ':clan'));
  return {
    player: seededPick(PLAYER_MISSION_POOL, PLAYER_MISSIONS_PER_DAY, rngP),
    clan:   seededPick(CLAN_MISSION_POOL,   CLAN_MISSIONS_PER_DAY,   rngC),
  };
}

export function ensurePlayerMissionState(userData) {
  const key = todayKey();
  if (!userData.missions || userData.missions.date !== key) {
    userData.missions = { date: key, progress: {}, claimed: [] };
    return true;
  }
  userData.missions.progress ||= {};
  userData.missions.claimed  ||= [];
  return false;
}

export function ensureClanClaimState(userData) {
  const key = todayKey();
  if (!userData.clanMissionsClaimed || userData.clanMissionsClaimed.date !== key) {
    userData.clanMissionsClaimed = { date: key, ids: [] };
    return true;
  }
  userData.clanMissionsClaimed.ids ||= [];
  return false;
}
