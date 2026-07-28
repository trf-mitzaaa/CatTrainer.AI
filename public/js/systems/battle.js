// ~~~~~~~~~~~~~~~~~~~
// folosim CLAUDE pentru a genera lecțiile și întrebările
// ~~~~~~~~~~~~~~~~~~~

import { t } from '../ui/i18n.js';
import { getPlayerProfile } from '../ui/onboarding.js';
import { POWERUPS } from './powerups.js';
import { getBattleConfig } from './gameconfig.js';
import { recordAiUsage } from './aistats.js';

const CLAUDE_API_KEY = '';
const CLAUDE_MODEL   = 'claude-haiku-4-5';   // fallback; adminul poate schimba din panou

const LANG_LABELS = {
  ro: 'română',
  en: 'English',
  fr: 'français',
  de: 'Deutsch',
  es: 'español',
};

// ~~~~~~~~~ clase ~~~~~~~~~~
function _grade() {
  const grade = (getPlayerProfile()?.grade || '').trim().toLowerCase();
  const num   = parseInt(grade, 10);
  if (!isNaN(num)) {
    if (num <= 4)  return `elevi de clasa ${num} (școală primară), limbaj foarte simplu`;
    if (num <= 8)  return `elevi de clasa ${num} (gimnaziu)`;
    if (num <= 12) return `elevi de clasa ${num} (liceu)`;
    return `studenți universitari, an ${num}`;
  }

  if (grade.startsWith('an')) return `studenți universitari (${getPlayerProfile()?.grade})`;
  return 'cursanți generali';
}

// ~~~~~~~~~ descriere pentru dificultăți ~~~~~~~~~~
const DIFF_INSTRUCTIONS = {
  easy:          'Nivel UȘOR — concepte de bază, vocabular simplu, răspunsuri evidente pentru un elev atent.',
  medium:        'Nivel MEDIU — necesită înțelegere reală, nu doar memorare.',
  'medium-hard': 'Nivel MEDIU-AVANSAT — aplicarea cunoștințelor, nu simpla recunoaștere.',
  hard:          'Nivel DIFICIL — gândire critică, nuanțe, excepții sau aplicații complexe.',
};

// ~~~~~~~~~ dificultăți ~~~~~~~~~~
const DIFF_RAMPS = {
  easy:          ['easy',   'easy',         'medium',        'medium',      'medium'],
  medium:        ['easy',   'medium',       'medium',        'medium-hard', 'hard'],
  'medium-hard': ['medium', 'medium',       'medium-hard',   'medium-hard', 'hard'],
  hard:          ['medium', 'medium-hard',  'hard',          'hard',        'hard'],
};

function _lang()    { return LANG_LABELS[(getPlayerProfile()?.language)] || 'română'; }
function _diff()    { return getPlayerProfile()?.difficulty || 'medium'; }

// ~~~~~~~~~ îl sunăm pe nenea claude ~~~~~~~~~~
async function askClaude(prompt) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        // headerul ăsta permite apeluri direct din browser (fără server propriu)
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: getBattleConfig().aiModel || CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const eb = await res.json().catch(() => ({}));
      console.error('[Claude]', res.status, eb?.error?.message || '');
      throw new Error('api-' + res.status);
    }
    const data = await res.json();
    // contorizăm consumul real de tokeni pentru pagina de statistici
    recordAiUsage(data.model || getBattleConfig().aiModel || CLAUDE_MODEL, data.usage).catch(() => {});
    // răspunsul vine ca listă de blocuri; luăm textul din primul
    return data.content?.[0]?.text || '';
  } catch (err) {
    console.error('[Claude]', err);
    throw err;
  }
}

// ~~~~~~~~~ generare lecție ~~~~~~~~~~
export async function generateLesson(topic) {
  const lang  = _lang();
  const grade = _grade();

  const prompt = `Ești Magicianul Whiskers, o pisică Game Master înțeleaptă care îi învață pe elevi într-un joc educațional în stil RPG numit CatTrainer.

Generează o lecție captivantă despre: ${topic}
Publicul țintă: ${grade}. 
Limba de răspuns: ${lang}. Scrie TOTUL în ${lang}.
SCRIE DOAR RĂSPUNSUL ÎN LIMBA CERUTĂ.

Formatează răspunsul astfel:

📜 Titlu: [Titlu atractiv]
(Când generezi titlul, nu scrie 📜 Titlu:)

[3–4 paragrafe de explicații clare și captivante. Folosește emoji-uri cu moderație. Include fapte importante, exemple concrete și mnemonici ușor de reținut. Cand scrii lecția, folosește termeni specifici publicului țintă.]

🐾 Idei cheie:
• [Ideea 1]
• [Ideea 2]
• [Ideea 3]
• [Ideea 4]

Lungime totală: 250–350 de cuvinte.`;

  return await askClaude(prompt);
}

// ~~~~~~~~~ generare întrebări ~~~~~~~~~~
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
- Evită jargon academic excesiv sau formulări de olimpiadă. În unele cazuri poți să folosești jargon academic. De exemplu, pentru elevi de la facultate.`;

  //Daca AI-ul nu raspunde, folosim intrebari de baza.
  const raw = await askClaude(prompt);
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

// ~~~~~~~~~ întrebări ~~~~~~~~~~
export async function generateBattleSet(topic, count = 3) {
  const ramp      = (DIFF_RAMPS[_diff()] || DIFF_RAMPS.medium).slice(0, count);
  const questions = [];
  for (let i = 0; i < count; i++) {
    const q = await generateQuestion(topic, ramp[i], questions.map(q => q.question));
    questions.push(q);
  }
  return questions;
}

// ~~~~~~~~~ manager bătălii ~~~~~~~~~~
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
    const bc = getBattleConfig();
    this.playerHP  = bc.playerHp;
    this.playerMax = bc.playerHp;
    this.enemyHP   = level.type === 'boss' ? bc.bossHp : bc.enemyHp;
    this.enemyMax  = this.enemyHP;

    this.consumables = {};
    POWERUPS.filter(p => p.type === 'consumable')
      .forEach(p => { this.consumables[p.id] = inventory.includes(p.id); });

    this.shieldActive = this.consumables['shield']       ?? false;
    this.mirrorActive = this.consumables['mirror_shard'] ?? false;

    this.buffs = {
      xpMult:            1,
      halfDamage:        false,
      hintOnWrong:       false,
      nextAttackCritical:false,
      doubleNextAttack:  false,
      firstAttackCrit:   true,
      strongConsumables: false,
      loseXpReward:      false,
      itemRefundChance:  0,
    };

    POWERUPS
      .filter(p => p.type === 'persistent' && inventory.includes(p.id) && typeof p.apply === 'function')
      .forEach(p => p.apply(this));

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

  _maybeRefund(itemId) {
    if (this.buffs.itemRefundChance > 0 && Math.random() < this.buffs.itemRefundChance) {
      this.consumables[itemId] = true;
      this.onDialogue('🪙 Moneda Norocoasă a refundat itemul!');
    }
  }

  // ~~~~~~~~~ răspundem la o întrebare ~~~~~~~~~~
  answerQuestion(answerIndex) {
    const q = this.currentQuestion();
    if (!q) return null;

    const isCorrect = answerIndex === q.correct;
    let damage = 0, playerDamage = 0;

    if (isCorrect) {
      this.correct++;
      this.streak++;
      damage = this.level.type === 'boss' ? 30 : 35;
      if (this.streak >= 2) damage += 10;

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

      if (this.shieldActive) {
        this.shieldActive = false;
        playerDamage      = 0;
        this.onDialogue('🛡️ Scutul a blocat atacul! Fără penalizare HP!');
      } else if (this.mirrorActive) {
        this.mirrorActive = false;
        this.consumables['mirror_shard'] = false;
        this.onConsumeItem('mirror_shard');
        playerDamage = 0;
        damage       = Math.ceil(base / 2);
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