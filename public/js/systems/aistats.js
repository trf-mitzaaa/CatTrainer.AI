// ~~~~~~~~~~~~~~~~~~~~~~~
// statistici pe care le luam cu ajutorul API-ului.
// ~~~~~~~~~~~~~~~~~~~~~~~
import { db } from '../core/firebase-config.js';
import { doc, setDoc, increment } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

function dayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Se apelează după fiecare răspuns reușit de la API (fire-and-forget). */
export async function recordAiUsage(model, usage = {}) {
  const inTok  = Number(usage.input_tokens)  || 0;
  const outTok = Number(usage.output_tokens) || 0;
  const key    = String(model).replace(/[^a-zA-Z0-9-]/g, '_');
  const bump   = {
    calls:        increment(1),
    inputTokens:  increment(inTok),
    outputTokens: increment(outTok),
  };
  await setDoc(doc(db, 'stats', 'aiUsage'), {
    total:   { ...bump },
    byModel: { [key]:      { ...bump } },
    byDay:   { [dayKey()]: { ...bump } },
  }, { merge: true });
}