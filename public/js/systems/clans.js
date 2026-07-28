// ~~~~~~~~~~~~~~~~~~~~
// CLANURI!! fiecare utilizator poate să intre într-un clan (mai bine zis o comunitate)
// momentan, utilizatorii au acces doar la misiunile clanului și chat.
// ~~~~~~~~~~~~~~~~~~~~

import { db } from '../core/firebase-config.js';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, where, limit, orderBy, onSnapshot,
  arrayUnion, arrayRemove, increment, deleteField, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const MAX_MEMBERS = 20;

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// ~~~~~~~~~~ luăm clanul după ID-ul primit ~~~~~~~~~~
export async function getClanById(clanId) {
  if (!clanId) return null;
  const snap = await getDoc(doc(db, 'clans', clanId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listClans(max = 20) {
  const q    = query(collection(db, 'clans'), orderBy('totalXp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function findClanByCode(code) {
  const q    = query(collection(db, 'clans'), where('code', '==', code.trim().toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ~~~~~~~~~~ creare clan ~~~~~~~~~~
export async function createClan(uid, displayName, { name, tag, emblem }) {
  name = (name || '').trim();
  tag  = (tag  || '').trim().toUpperCase();
  if (name.length < 3 || name.length > 24) throw new Error('Numele clanului: 3–24 caractere.');
  if (tag.length  < 2 || tag.length  > 4)  throw new Error('Tag-ul: 2–4 caractere.');

  const ref = doc(collection(db, 'clans'));
  const clan = {
    name,
    tag,
    emblem:      emblem || '🛡️',
    code:        makeCode(),
    ownerUid:    uid,
    members:     [uid],
    memberNames: { [uid]: displayName || 'Erou' },
    totalXp:     0,
    createdAt:   serverTimestamp(),
    missions:    { date: '', progress: {} },
  };
  await setDoc(ref, clan);
  return { id: ref.id, ...clan };
}

// ~~~~~~~~~~ ieșire/intrare într-un clan ~~~~~~~~~~
async function joinExisting(uid, displayName, clan) {
  if (clan.members.includes(uid)) return clan;
  if (clan.members.length >= MAX_MEMBERS) throw new Error('Clanul este plin.');

  await updateDoc(doc(db, 'clans', clan.id), {
    members: arrayUnion(uid),
    [`memberNames.${uid}`]: displayName || 'Erou',
  });
  return { ...clan, members: [...clan.members, uid] };
}

export async function joinClan(uid, displayName, code) {
  const clan = await findClanByCode(code);
  if (!clan) throw new Error('Nu există niciun clan cu acest cod.');
  return joinExisting(uid, displayName, clan);
}

export async function joinClanById(uid, displayName, clanId) {
  const clan = await getClanById(clanId);
  if (!clan) throw new Error('Clanul nu mai există.');
  return joinExisting(uid, displayName, clan);
}

export async function leaveClan(uid, clan) {
  const ref       = doc(db, 'clans', clan.id);
  const remaining = clan.members.filter(m => m !== uid);

  if (remaining.length === 0) {
    await deleteDoc(ref);    //dacă ultimul utilizator iese din clan, clanul se șterge automat.
    return { deleted: true };
  }

  const updates = {
    members: arrayRemove(uid),
    [`memberNames.${uid}`]: deleteField(),
  };
  if (clan.ownerUid === uid) updates.ownerUid = remaining[0];   // predăm ștafeta de lider la următorul.
  await updateDoc(ref, updates);
  return { deleted: false };
}

// ~~~~~~~~~~ progress la misiuni ~~~~~~~~~~
export async function contributeClanXp(clanId, xp) {
  if (!clanId || !xp) return;
  await updateDoc(doc(db, 'clans', clanId), { totalXp: increment(xp) });
}

export async function contributeClanMissions(clanId, todayKey, amounts) {
  if (!clanId || !amounts || Object.keys(amounts).length === 0) return;
  const ref  = doc(db, 'clans', clanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const cur      = snap.data().missions || {};
  const progress = cur.date === todayKey ? { ...(cur.progress || {}) } : {};
  for (const [id, amt] of Object.entries(amounts)) {
    progress[id] = (progress[id] || 0) + amt;
  }
  await updateDoc(ref, { missions: { date: todayKey, progress } });
}


// ~~~~~~~~~~ Buff-uri pentru membrii clanului care se pot lua cu clan coins ~~~~~~~~~~

function dateKeyPlus(fromKey, days) {
  const d = fromKey ? new Date(fromKey + 'T12:00:00') : new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function buyClanBuff(clanId, key, days, todayKey) {
  const ref  = doc(db, 'clans', clanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Clanul nu mai există.');

  const buffs   = snap.data().buffs || {};
  const current = buffs[key] && buffs[key] >= todayKey ? buffs[key] : null;
  const expiry  = dateKeyPlus(current || todayKey, current ? days : days - 1);

  await updateDoc(ref, { [`buffs.${key}`]: expiry });
  return expiry;
}


// ~~~~~~~~~~ clan chat (din păcate nefiltrat încă (adică anything goes)) ~~~~~~~~~~

const MSG_TEXT_MAX = 500;
const MSG_IMG_MAX  = 500_000;   // limită de spațiu

export async function sendClanMessage(clanId, { uid, name, text, img }) {
  const msg = {
    uid,
    name:      String(name || 'Erou').slice(0, 30),
    createdAt: serverTimestamp(),
  };
  if (text) msg.text = String(text).slice(0, MSG_TEXT_MAX);
  if (img) {
    if (!img.startsWith('data:image/')) throw new Error('bad-image');
    if (img.length > MSG_IMG_MAX)       throw new Error('img-too-big');
    msg.img = img;
  }
  if (!msg.text && !msg.img) return;
  await addDoc(collection(db, 'clans', clanId, 'messages'), msg);
}

export function listenClanMessages(clanId, callback, max = 50) {
  const q = query(
    collection(db, 'clans', clanId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .reverse();
    callback(msgs);
  }, (err) => {
    console.error('[clanChat]', err);
    callback(null, err);
  });
}

export async function deleteClanMessage(clanId, msgId) {
  await deleteDoc(doc(db, 'clans', clanId, 'messages', msgId));
}