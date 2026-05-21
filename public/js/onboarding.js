// js/onboarding.js
// ─────────────────────────────────────────────────────────────────────────────
//  CatTrainer RPG — Onboarding Questionnaire
//
//  Shows a 5-step wizard on first login. Saves the profile to Firebase at
//  users/{uid} (merged into the main user document) so db.js / battle.js
//  can read it without any extra queries.
//
//  Exports:
//    showOnboarding(uid, onComplete)  — call after new account creation
//    getPlayerProfile()               — returns last saved profile object
//    computeDifficulty(profile)       — 'easy' | 'medium' | 'medium-hard' | 'hard'
// ─────────────────────────────────────────────────────────────────────────────

import { db } from './firebase-config.js';
import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { applyLanguage, t } from './i18n.js';

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
    {
        id:       'age',
        icon:     '🎂',
        title:    'Câți ani ai?',
        subtitle: 'Ajută-ne să adaptăm dificultatea pentru tine.',
        type:     'choice',
        options: [
            { value: 'under10', label: '< 10 ani',           emoji: '🐣' },
            { value: '10-12',   label: '10 – 12',            emoji: '🐱' },
            { value: '13-15',   label: '13 – 15',            emoji: '⚔️' },
            { value: '16-18',   label: '16+',                emoji: '🔥' },
            { value: 'adult',   label: 'Adult / Profesor',   emoji: '🎓' },
        ],
    },
    {
        id:          'grade',
        icon:        '🏫',
        title:       'Ce clasă ești?',
        subtitle:    'Scrie numărul clasei (ex: 8) sau anul de facultate (ex: Anul 1).',
        type:        'text',
        placeholder: 'ex: 8   sau   Anul 1',
    },
    {
        id:       'interests',
        icon:     '✨',
        title:    'Ce materii îți plac?',
        subtitle: 'Alege una sau mai multe — le vom evidenția pe hartă.',
        type:     'multi',
        options: [
            { value: 'math',            label: 'Matematică',  emoji: '🔢' },
            { value: 'biology',         label: 'Biologie',    emoji: '🌿' },
            { value: 'history',         label: 'Istorie',     emoji: '📜' },
            { value: 'literature',      label: 'Literatură',  emoji: '📖' },
            { value: 'computerscience', label: 'Informatică', emoji: '💻' },
            { value: 'physics',         label: 'Fizică',      emoji: '⚡' },
            { value: 'chemistry',       label: 'Chimie',      emoji: '⚗️' },
        ],
    },
    {
        id:       'language',
        icon:     '🌐',
        title:    'Limba preferată',
        subtitle: 'Lecțiile și explicațiile AI vor folosi această limbă.',
        type:     'choice',
        options: [
            { value: 'ro', label: 'Română',   emoji: '🇷🇴' },
            { value: 'en', label: 'English',  emoji: '🇬🇧' },
            { value: 'fr', label: 'Français', emoji: '🇫🇷' },
            { value: 'de', label: 'Deutsch',  emoji: '🇩🇪' },
            { value: 'es', label: 'Español',  emoji: '🇪🇸' },
        ],
    },
    {
        id:       'goal',
        icon:     '🏆',
        title:    'Care este scopul tău?',
        subtitle: 'Vom personaliza ritmul și tipul de exerciții.',
        type:     'choice',
        options: [
            { value: 'fun',     label: 'Mă distrez & învăț',         emoji: '🎉' },
            { value: 'school',  label: 'Pregătesc testele',           emoji: '📋' },
            { value: 'exam',    label: 'Examen mare (BAC/Olimpiadă)', emoji: '🏅' },
            { value: 'explore', label: 'Explorez subiecte noi',       emoji: '🔭' },
            { value: 'teacher', label: 'Sunt profesor / tutore',      emoji: '👨‍🏫' },
        ],
    },
];

// ── In-memory cache ───────────────────────────────────────────────────────────
let _profile = null;

export function getPlayerProfile() { return _profile; }

// ── Difficulty mapping ────────────────────────────────────────────────────────
export function computeDifficulty(profile) {
    if (!profile) return 'medium';
    const { age, grade, goal } = profile;
    const gradeStr = (grade || '').trim().toLowerCase();
    const gradeNum = parseInt(gradeStr, 10);
    const isCollege = gradeStr.startsWith('an') || gradeStr.includes('facultate');
    if (age === 'under10' || (!isNaN(gradeNum) && gradeNum <= 4)) return 'easy';
    if (!isNaN(gradeNum) && gradeNum <= 8) return 'medium';
    if (!isNaN(gradeNum) && gradeNum <= 10) return 'medium-hard';
    if ((!isNaN(gradeNum) && gradeNum >= 11) || isCollege) {
        return (goal === 'exam' || goal === 'explore') ? 'hard' : 'medium-hard';
    }
    return 'medium';
}

// ── Main entry point ──────────────────────────────────────────────────────────
/**
 * Renders the onboarding overlay and calls onComplete(profile) when done.
 * @param {string}   uid
 * @param {Function} onComplete
 */
export function showOnboarding(uid, onComplete) {
    const overlay = document.createElement('div');
    overlay.id        = 'onboardingOverlay';
    overlay.className = 'onb-overlay';
    overlay.innerHTML = _buildHTML();
    document.body.appendChild(overlay);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => overlay.classList.add('onb-visible'));

    const answers     = {};
    let   currentStep = 0;

    const stepEls    = overlay.querySelectorAll('.onb-step');
    const backBtn    = overlay.querySelector('#onbBack');
    const nextBtn    = overlay.querySelector('#onbNext');
    const dotsWrap   = overlay.querySelector('#onbDots');
    const progressEl = overlay.querySelector('#onbProgress');

    // Build step dots
    STEPS.forEach((_, i) => {
        const d = document.createElement('div');
        d.className = 'onb-dot' + (i === 0 ? ' active' : '');
        dotsWrap.appendChild(d);
    });

    // ── Render a step ──
    function render(idx) {
        stepEls.forEach((el, i) => el.classList.toggle('onb-step--active', i === idx));

        dotsWrap.querySelectorAll('.onb-dot').forEach((d, i) => {
            d.classList.toggle('active',    i === idx);
            d.classList.toggle('completed', i < idx);
        });

        progressEl.style.width = `${(idx / STEPS.length) * 100}%`;
        backBtn.style.display  = idx === 0 ? 'none' : 'inline-flex';

        const isLast = idx === STEPS.length - 1;
        nextBtn.textContent = isLast ? t('onb.finish') : t('onb.next');
        nextBtn.classList.toggle('onb-btn--gold',    isLast);
        nextBtn.classList.toggle('onb-btn--primary', !isLast);

        _syncNextBtn(idx, answers, nextBtn);
    }

    // ── Text input handler ──
    overlay.addEventListener('input', (e) => {
        if (!e.target.classList.contains('onb-text-input')) return;
        answers[STEPS[currentStep].id] = e.target.value.trim();
        _syncNextBtn(currentStep, answers, nextBtn);
    });

    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && STEPS[currentStep].type === 'text' && _stepValid(currentStep, answers)) {
            nextBtn.click();
        }
    });

    // ── Option click handler (delegated) ──
    overlay.addEventListener('click', (e) => {
        const opt = e.target.closest('.onb-option');
        if (!opt) return;

        const step = STEPS[currentStep];
        const val  = opt.dataset.value;

        if (step.type === 'multi') {
            const set = new Set(answers[step.id] || []);
            set.has(val) ? set.delete(val) : set.add(val);
            answers[step.id] = [...set];
            overlay.querySelectorAll(`[data-step="${step.id}"] .onb-option`).forEach(o =>
                o.classList.toggle('selected', answers[step.id].includes(o.dataset.value))
            );
        } else {
            answers[step.id] = val;
            overlay.querySelectorAll(`[data-step="${step.id}"] .onb-option`).forEach(o =>
                o.classList.toggle('selected', o.dataset.value === val)
            );
            // Live language preview when user picks a language
            if (step.id === 'language') {
                applyLanguage(val);
                // Re-sync nav button labels to new language
                const isLast = currentStep === STEPS.length - 1;
                nextBtn.textContent = isLast ? t('onb.finish') : t('onb.next');
                backBtn.textContent = t('onb.back');
            }
        }

        _syncNextBtn(currentStep, answers, nextBtn);
    });

    // ── Next button ──
    nextBtn.addEventListener('click', () => {
        if (!_stepValid(currentStep, answers)) return;
        if (currentStep < STEPS.length - 1) {
            currentStep++;
            render(currentStep);
        } else {
            _finish(uid, answers, overlay, onComplete);
        }
    });

    // ── Back button ──
    backBtn.addEventListener('click', () => {
        if (currentStep > 0) { currentStep--; render(currentStep); }
    });

    render(0);
}

// ── Save profile & close ──────────────────────────────────────────────────────
async function _finish(uid, answers, overlay, onComplete) {
    const profile = {
        age:         answers.age       || 'unknown',
        grade:       answers.grade     || 'unknown',
        interests:   answers.interests || [],
        language:    answers.language  || 'ro',
        goal:        answers.goal      || 'fun',
        difficulty:  computeDifficulty(answers),
        profileDone: true,
        profileAt:   Date.now(),
    };

    _profile = profile;

    // Disable nav while saving
    const nextBtn = overlay.querySelector('#onbNext');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = t('onb.saving'); }

    try {
        // Merge profile fields into the main user document (same path db.js uses)
        await updateDoc(doc(db, 'users', uid), {
            profile,
            lastActivity: serverTimestamp(),
        });
    } catch (err) {
        console.warn('[Onboarding] Firebase save failed:', err.message);
        // Don't block the user — proceed anyway
    }

    // Animate out then call onComplete
    overlay.classList.remove('onb-visible');
    overlay.addEventListener('transitionend', () => {
        overlay.remove();
        onComplete(profile);
    }, { once: true });
}

// ── HTML builder ──────────────────────────────────────────────────────────────
function _buildHTML() {
    const stepsHTML = STEPS.map(step => {
        const content = step.type === 'text'
            ? `<div class="onb-text-wrap">
                 <input class="onb-text-input" type="text"
                   placeholder="${step.placeholder || ''}"
                   autocomplete="off" maxlength="20" />
                 <p class="onb-text-hint">
                   Clasele 1–12: scrie numărul (ex: <strong>8</strong>)<br>
                   Facultate: scrie anul (ex: <strong>Anul 1</strong>)
                 </p>
               </div>`
            : `<div class="onb-options onb-options--${step.type}">
                 ${step.options.map(o => `
                   <button class="onb-option" data-value="${o.value}" type="button">
                     <span class="onb-opt-emoji">${o.emoji}</span>
                     <span class="onb-opt-label">${o.label}</span>
                   </button>`).join('')}
               </div>
               ${step.type === 'multi' ? `<p class="onb-multi-hint" data-i18n="onb.multi.hint">${t('onb.multi.hint')}</p>` : ''}`;

        return `
    <div class="onb-step" data-step="${step.id}">
      <div class="onb-step-icon">${step.icon}</div>
      <h3 class="onb-step-title">${step.title}</h3>
      <p class="onb-step-sub">${step.subtitle}</p>
      ${content}
    </div>`;
    }).join('');

    return `
    <div class="onb-card">
      <div class="onb-header">
        <div class="onb-cat">🐱</div>
        <h2 class="onb-title" data-i18n="onb.title">Bun venit, Aventurierule!</h2>
        <p class="onb-subtitle" data-i18n="onb.subtitle">Câteva întrebări ca să îți personalizăm aventura.</p>
      </div>

      <div class="onb-progress-track">
        <div class="onb-progress-fill" id="onbProgress"></div>
      </div>

      <div class="onb-dots" id="onbDots"></div>

      <div class="onb-steps">${stepsHTML}</div>

      <div class="onb-nav">
        <button class="onb-btn onb-btn--ghost" id="onbBack" style="display:none;" data-i18n="onb.back">← Înapoi</button>
        <button class="onb-btn onb-btn--primary" id="onbNext" disabled data-i18n="onb.next">Continuă ➡️</button>
      </div>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _stepValid(idx, answers) {
    const step = STEPS[idx];
    if (step.type === 'multi') return (answers[step.id] || []).length > 0;
    if (step.type === 'text')  return (answers[step.id] || '').length > 0;
    return !!answers[step.id];
}

function _syncNextBtn(idx, answers, btn) {
    btn.disabled = !_stepValid(idx, answers);
}

// ── Profile setter (used by db.js to restore cache for returning users) ───────
export function setPlayerProfile(profile) { _profile = profile; }