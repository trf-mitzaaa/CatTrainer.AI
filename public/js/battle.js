// js/battle.js

import { t } from './i18n.js';
import { getPlayerProfile } from './onboarding.js';
import { POWERUPS } from './powerups.js';

const GEMINI_API_KEY = 'AIzaSyAYJ5lT_PFwr9ypUXV0nCxkroZHELCbwp4';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

// ── Language label map ────────────────────────────────────────────────────────
const LANG_LABELS = {
  ro: 'română',
  en: 'English',
  fr: 'français',
  de: 'Deutsch',
  es: 'español',
};

// ── Grade context — built dynamically from free-text grade string ─────────────
// grade is now whatever the user typed: "8", "12", "Anul 2", etc.
function _grade() {
  const grade = (getPlayerProfile()?.grade || '').trim().toLowerCase();
  const num   = parseInt(grade, 10);
  if (!isNaN(num)) {
    if (num <= 4)  return `elevi de clasa ${num} (școală primară), limbaj foarte simplu`;
    if (num <= 8)  return `elevi de clasa ${num} (gimnaziu)`;
    if (num <= 12) return `elevi de clasa ${num} (liceu)`;
    return `studenți universitari, an ${num}`;
  }
  // "Anul X" or any college text
  if (grade.startsWith('an')) return `studenți universitari (${getPlayerProfile()?.grade})`;
  return 'cursanți generali';
}

// ── Difficulty descriptions sent to Gemini ────────────────────────────────────
const DIFF_INSTRUCTIONS = {
  easy:          'Nivel UȘOR — concepte de bază, vocabular simplu, răspunsuri evidente pentru un elev atent.',
  medium:        'Nivel MEDIU — necesită înțelegere reală, nu doar memorare.',
  'medium-hard': 'Nivel MEDIU-AVANSAT — aplicarea cunoștințelor, nu simpla recunoaștere.',
  hard:          'Nivel DIFICIL — gândire critică, nuanțe, excepții sau aplicații complexe.',
};

// ── Difficulty ramps (per base difficulty, 5 questions max) ──────────────────
const DIFF_RAMPS = {
  easy:          ['easy',   'easy',         'medium',        'medium',      'medium'],
  medium:        ['easy',   'medium',       'medium',        'medium-hard', 'hard'],
  'medium-hard': ['medium', 'medium',       'medium-hard',   'medium-hard', 'hard'],
  hard:          ['medium', 'medium-hard',  'hard',          'hard',        'hard'],
};

// ── Profile helpers ───────────────────────────────────────────────────────────
function _lang()    { return LANG_LABELS[(getPlayerProfile()?.language)] || 'română'; }
function _diff()    { return getPlayerProfile()?.difficulty || 'medium'; }

// ── Core Gemini call ──────────────────────────────────────────────────────────
async function askGemini(prompt) {
  try {
    const res = await fetch(GEMINI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err) {
    console.error('[Gemini]', err);
    throw err;
  }
}

// ── Generate Lesson ───────────────────────────────────────────────────────────
export async function generateLesson(topic) {
  const lang  = _lang();
  const grade = _grade();

  const prompt = `Ești Magicianul Whiskers, o pisică Game Master înțeleaptă și jucăușă \
care îi învață pe elevi într-un joc educațional în stil RPG numit CatTrainer.

Generează o lecție distractivă și captivantă despre: ${topic}
Publicul țintă: ${grade}.
Limba de răspuns: ${lang}. Scrie TOTUL în ${lang}.
SCRIE DOAR RĂSPUNSUL ÎN LIMBA CERUTĂ.

Formatează răspunsul astfel:

📜 Titlu: [Titlu atractiv]
(Când generezi titlul, nu scrie 📜 Titlu:)

[3–4 paragrafe de explicații clare și captivante. Folosește emoji-uri cu moderație. \
Include fapte importante, exemple concrete și mnemonici ușor de reținut.]

🐾 Idei cheie:
• [Ideea 1]
• [Ideea 2]
• [Ideea 3]
• [Ideea 4]

Lungime totală: 250–350 de cuvinte.`;

  return await askGemini(prompt);
}

// ── Generate one Question ─────────────────────────────────────────────────────
export async function generateQuestion(topic, difficulty = null, previousQuestions = []) {
  const lang     = _lang();
  const grade    = _grade();
  const diff     = difficulty || _diff();
  const diffText = DIFF_INSTRUCTIONS[diff] || DIFF_INSTRUCTIONS.medium;
  const prevList = previousQuestions.length > 0
      ? `Evită aceste întrebări deja folosite: ${previousQuestions.join(' | ')}.`
      : '';

  const prompt = `Ești Profesorul Whiskers, un Game Master pisică într-un joc educațional RPG numit CatTrainer.

Generează O singură întrebare cu 4 răspunsuri multiple despre: ${topic}
Publicul țintă: ${grade}.
${diffText}
${prevList}
Limba de răspuns: ${lang}. Scrie TOTUL în ${lang}.

RĂSPUNDE DOAR CU JSON valid, fără markdown și fără text suplimentar:
{
  "question": "Textul întrebării?",
  "answers": ["Răspuns A", "Răspuns B", "Răspuns C", "Răspuns D"],
  "correct": 0,
  "explanation": ""
}

Reguli stricte:
- "correct" este indexul 0–3 al răspunsului corect în "answers".
- Amestecă răspunsurile — răspunsul corect NU trebuie să fie mereu primul.
- Întrebarea: maximum 18 cuvinte, clară, testează un singur concept.
- Fiecare răspuns: maximum 12 cuvinte.
- Răspunsurile greșite trebuie să fie plauzibile dar clar incorecte.
- Evită jargon academic excesiv sau formulări de olimpiadă.`;

  const raw = await askGemini(prompt);
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return {
      question: `Care afirmație despre "${topic}" este corectă?`,
      answers: [
        'Respectă principiile studiate la clasă',
        'Nu are legătură cu știința consacrată',
        'Contrazice toate cercetările moderne',
        'Nu a fost încă studiat de cercetători',
      ],
      correct:     0,
      explanation: '',
    };
  }
}

// ── Generate full question set ────────────────────────────────────────────────
export async function generateBattleSet(topic, count = 3) {
  const ramp      = (DIFF_RAMPS[_diff()] || DIFF_RAMPS.medium).slice(0, count);
  const questions = [];
  for (let i = 0; i < count; i++) {
    const q = await generateQuestion(topic, ramp[i], questions.map(q => q.question));
    questions.push(q);
  }
  return questions;
}

// ── Battle State Manager ──────────────────────────────────────────────────────
export class BattleManager {
  constructor({ subject, level, inventory = [], onDialogue, onUpdateHP, onVictory, onDefeat, onConsumeItem }) {
    this.subject       = subject;
    this.level         = level;
    this.onDialogue    = onDialogue;
    this.onUpdateHP    = onUpdateHP;
    this.onVictory     = onVictory;
    this.onDefeat      = onDefeat;
    this.onConsumeItem = onConsumeItem || (() => {});

    this.questions = [];
    this.currentQ  = 0;
    this.correct   = 0;
    this.streak    = 0;
    this.playerHP  = 100;
    this.playerMax = 100;
    this.enemyHP   = level.type === 'boss' ? 150 : 100;
    this.enemyMax  = this.enemyHP;

    // ── Consumable availability ───────────────────────────────────────────────
    this.consumables = {};
    POWERUPS.filter(p => p.type === 'consumable')
      .forEach(p => { this.consumables[p.id] = inventory.includes(p.id); });

    // Shield and mirror_shard are passive — tracked separately
    this.shieldActive = this.consumables['shield']       ?? false;
    this.mirrorActive = this.consumables['mirror_shard'] ?? false;

    // ── Buff defaults ─────────────────────────────────────────────────────────
    this.buffs = {
      xpMult:            1,
      halfDamage:        false,
      hintOnWrong:       false,
      nextAttackCritical:false,
      doubleNextAttack:  false,
      firstAttackCrit:   true,   // will be consumed on first correct answer
      strongConsumables: false,
      loseXpReward:      false,
      itemRefundChance:  0,
    };

    // Apply all owned persistent buffs
    POWERUPS
      .filter(p => p.type === 'persistent' && inventory.includes(p.id) && typeof p.apply === 'function')
      .forEach(p => p.apply(this));

    // firstAttackCrit only active if player actually owns assassin_blade
    if (!inventory.includes('assassin_blade')) {
      this.buffs.firstAttackCrit = false;
    }
  }

  async loadQuestions() {
    const count    = this.level.type === 'boss' ? 5 : 3;
    this.questions = await generateBattleSet(this.level.topic, count);
  }

  currentQuestion() {
    return this.questions[this.currentQ] || null;
  }

  // ── HP Potion ─────────────────────────────────────────────────────────────
  useHpPotion() {
    if (!this.consumables['hp_potion']) return false;
    const heal = this.buffs.strongConsumables ? 45 : 30;
    this.playerHP                 = Math.min(this.playerMax, this.playerHP + heal);
    this.consumables['hp_potion'] = false;
    this.onConsumeItem('hp_potion');
    this._maybeRefund('hp_potion');
    this.onUpdateHP({ enemyHP: this.enemyHP, enemyMax: this.enemyMax, playerHP: this.playerHP, playerMax: this.playerMax });
    this.onDialogue(`🧪 Poțiune folosită! +${heal} HP recuperat!`);
    return true;
  }

  // ── Hint Stone ────────────────────────────────────────────────────────────
  useHintStone() {
    if (!this.consumables['hint_stone']) return -1;
    const q = this.currentQuestion();
    if (!q) return -1;
    const wrong = q.answers.map((_, i) => i).filter(i => i !== q.correct);
    if (wrong.length === 0) return -1;
    const idx                      = wrong[Math.floor(Math.random() * wrong.length)];
    this.consumables['hint_stone'] = false;
    this.onConsumeItem('hint_stone');
    this._maybeRefund('hint_stone');
    this.onDialogue('💎 Piatra Indiciului a eliminat un răspuns greșit!');
    return idx;
  }

  // ── Lucky coin refund ─────────────────────────────────────────────────────
  _maybeRefund(itemId) {
    if (this.buffs.itemRefundChance > 0 && Math.random() < this.buffs.itemRefundChance) {
      this.consumables[itemId] = true;
      this.onDialogue('🪙 Moneda Norocoasă a refundat itemul!');
    }
  }

  // ── Answer a question ─────────────────────────────────────────────────────
  answerQuestion(answerIndex) {
    const q = this.currentQuestion();
    if (!q) return null;

    const isCorrect = answerIndex === q.correct;
    let damage = 0, playerDamage = 0;

    if (isCorrect) {
      this.correct++;
      this.streak++;
      damage = this.level.type === 'boss' ? 30 : 35;
      if (this.streak >= 2) damage += 10; // streak bonus

      // ── Critical hit buffs ────────────────────────────────────────────────
      let isCrit = false;
      if (this.buffs.nextAttackCritical) {
        damage *= this.buffs.strongConsumables ? 3 : 2;
        this.buffs.nextAttackCritical = false;
        isCrit = true;
      } else if (this.buffs.firstAttackCrit) {
        damage *= 2;
        this.buffs.firstAttackCrit = false;
        isCrit = true;
      } else if (this.buffs.doubleNextAttack) {
        damage *= 2;
        this.buffs.doubleNextAttack = false;
        isCrit = true;
      }

      this.onDialogue(isCrit ? `💥 CRITIC! ${t('gm.correct')}` : t('gm.correct'));

    } else {
      this.streak = 0;
      const base  = this.level.type === 'boss' ? 30 : 25;

      // ── Passive damage reduction ──────────────────────────────────────────
      if (this.shieldActive) {
        this.shieldActive = false;
        playerDamage      = 0;
        this.onDialogue('🛡️ Scutul a blocat atacul! Fără penalizare HP!');
      } else if (this.mirrorActive) {
        // Mirror shard: reflect — player takes 0, enemy takes half base damage
        this.mirrorActive = false;
        this.consumables['mirror_shard'] = false;
        this.onConsumeItem('mirror_shard');
        playerDamage = 0;
        damage       = Math.ceil(base / 2); // reflected back
        this.onDialogue('🪞 Oglinda a reflectat atacul! Inamicul ia damage!');
      } else {
        playerDamage = this.buffs.halfDamage ? Math.ceil(base / 2) : base;
        this.onDialogue(t('gm.wrong'));
      }
    }

    this.enemyHP  = Math.max(0, this.enemyHP  - damage);
    this.playerHP = Math.max(0, this.playerHP - playerDamage);

    this.onUpdateHP({
      enemyHP:   this.enemyHP,
      enemyMax:  this.enemyMax,
      playerHP:  this.playerHP,
      playerMax: this.playerMax,
    });

    const result = {
      isCorrect,
      damage,
      playerDamage,
      explanation: q.explanation,
      correct:     q.correct,
      showHint:    !isCorrect && this.buffs.hintOnWrong,
      gameOver:    this.enemyHP <= 0 || this.playerHP <= 0,
      won:         this.enemyHP <= 0,
    };

    this.currentQ++;
    return result;
  }

  hasMoreQuestions() {
    return this.currentQ < this.questions.length && this.playerHP > 0 && this.enemyHP > 0;
  }

  getAccuracy() {
    if (this.currentQ === 0) return 0;
    return Math.round((this.correct / this.currentQ) * 100);
  }

  getXpMultiplier() { return this.buffs.xpMult; }

  hasLoseXpReward() { return this.buffs.loseXpReward; }

  resolveOutcome() {
    if (this.enemyHP <= 0)       this.onVictory();
    else if (this.playerHP <= 0) this.onDefeat();
    else this.enemyHP < this.playerHP ? this.onVictory() : this.onDefeat();
  }
}
