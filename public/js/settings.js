// js/settings.js
import { auth } from './firebase-config.js';
import {
    updatePassword,
    deleteUser,
    sendEmailVerification,
    reauthenticateWithCredential,
    EmailAuthProvider,
    GoogleAuthProvider,
    reauthenticateWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
    doc, deleteDoc, updateDoc, getDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { db }        from './firebase-config.js';
import { showToast } from './ui.js';
import { t }         from './i18n.js';

// ── Provider helpers ──────────────────────────────────────────────────────────
function isEmailUser() {
    return auth.currentUser?.providerData.some(p => p.providerId === 'password') ?? false;
}
function isGoogleUser() {
    return auth.currentUser?.providerData.some(p => p.providerId === 'google.com') ?? false;
}

// ── Re-authenticate ───────────────────────────────────────────────────────────
async function reauthenticate(currentPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('Nu ești autentificat.');
    if (isEmailUser()) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
    } else if (isGoogleUser()) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }
}

// ── Render settings tab ───────────────────────────────────────────────────────
export function renderSettings(userData) {
    const container = document.getElementById('settingsContent');
    if (!container) return;
    const user = auth.currentUser;
    if (!user) return;

    const emailVerified       = user.emailVerified;
    const showPasswordSection = isEmailUser();

    container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">${t('settings.email.title')}</div>
      ${emailVerified
        ? `<div class="settings-verified-badge">${t('settings.email.verified')}${userData?.emailVerifiedBonus ? '' : t('settings.email.bonus')}</div>`
        : `<div class="settings-unverified">
             <p class="settings-hint">${t('settings.email.hint')}</p>
             <button class="settings-btn settings-btn--gold" id="sendVerifyBtn">
               ${t('settings.email.send')}
             </button>
           </div>`
    }
    </div>

    ${showPasswordSection ? `
    <div class="settings-section">
      <div class="settings-section-title">${t('settings.password.title')}</div>
      <input type="password" id="currentPasswordInput" class="rpg-input" placeholder="${t('settings.password.current')}" />
      <input type="password" id="newPasswordInput"     class="rpg-input" placeholder="${t('settings.password.new')}" />
      <input type="password" id="confirmPasswordInput" class="rpg-input" placeholder="${t('settings.password.confirm')}" />
      <button class="settings-btn settings-btn--purple" id="changePasswordBtn">
        ${t('settings.password.btn')}
      </button>
    </div>
    ` : `
    <div class="settings-section">
      <div class="settings-section-title">${t('settings.password.google')}</div>
      <p class="settings-hint">${t('settings.password.google.hint')}</p>
    </div>
    `}

    <div class="settings-section settings-section--danger">
      <div class="settings-section-title">${t('settings.reset.title')}</div>
      <p class="settings-hint">${t('settings.reset.hint')}</p>
      <button class="settings-btn settings-btn--warning" id="resetProgressBtn">
        ${t('settings.reset.btn')}
      </button>
    </div>

    <div class="settings-section settings-section--danger">
      <div class="settings-section-title">${t('settings.delete.title')}</div>
      <p class="settings-hint">${t('settings.delete.hint')}</p>
      <button class="settings-btn settings-btn--red" id="deleteAccountBtn">
        ${t('settings.delete.btn')}
      </button>
    </div>
  `;

    bindSettingsButtons(userData);
}

// ── Settings button bindings ──────────────────────────────────────────────────
function bindSettingsButtons(userData) {
    document.getElementById('sendVerifyBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('sendVerifyBtn');
        btn.disabled    = true;
        btn.textContent = t('settings.email.sending');
        try {
            await sendEmailVerification(auth.currentUser);
            showToast(t('toast.email.sent'));
            btn.textContent = t('settings.email.sent');
        } catch (err) {
            showToast('❌ ' + friendlySettingsError(err.code));
            btn.disabled    = false;
            btn.textContent = t('settings.email.send');
        }
    });

    document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
        const current = document.getElementById('currentPasswordInput')?.value;
        const newPwd  = document.getElementById('newPasswordInput')?.value;
        const confirm = document.getElementById('confirmPasswordInput')?.value;

        if (!current || !newPwd || !confirm) return showToast(t('toast.fields.password'));
        if (newPwd.length < 6)               return showToast(t('toast.password.short'));
        if (newPwd !== confirm)              return showToast(t('toast.password.match'));

        const btn       = document.getElementById('changePasswordBtn');
        btn.disabled    = true;
        btn.textContent = t('settings.password.updating');
        try {
            await reauthenticate(current);
            await updatePassword(auth.currentUser, newPwd);
            showToast(t('toast.password.ok'));
            document.getElementById('currentPasswordInput').value = '';
            document.getElementById('newPasswordInput').value     = '';
            document.getElementById('confirmPasswordInput').value = '';
        } catch (err) {
            showToast('❌ ' + friendlySettingsError(err.code));
        } finally {
            btn.disabled    = false;
            btn.textContent = t('settings.password.btn');
        }
    });

    document.getElementById('resetProgressBtn')?.addEventListener('click', () => {
        showConfirmModal({
            icon:         '🔄',
            title:        t('settings.reset.confirm.title'),
            message:      t('settings.reset.confirm.msg'),
            confirmText:  t('settings.reset.confirm.btn'),
            confirmClass: 'settings-btn--warning',
            onConfirm:    doResetProgress,
        });
    });

    document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
        showConfirmModal({
            icon:         '💀',
            title:        t('settings.delete.confirm.title'),
            message:      t('settings.delete.confirm.msg'),
            confirmText:  t('settings.delete.confirm.btn'),
            confirmClass: 'settings-btn--red',
            onConfirm:    doDeleteAccount,
        });
    });
}

// ── Reset progress ────────────────────────────────────────────────────────────
async function doResetProgress() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await updateDoc(doc(db, 'users', user.uid), {
            xp: 0, gold: 0, level: 1,
            battlesWon: 0, lessonsCompleted: 0, streak: 0,
            realmProgress: {}, achievements: [], inventory: [],
            lastActivity: serverTimestamp(),
        });
        showToast(t('toast.reset.ok'));
        window.dispatchEvent(new CustomEvent('userDataReset'));
    } catch (err) {
        showToast(t('toast.reset.error'));
        console.error('[resetProgress]', err);
    }
}

// ── Delete account ────────────────────────────────────────────────────────────
async function doDeleteAccount() {
    const user = auth.currentUser;
    if (!user) return;
    if (isEmailUser()) {
        showPasswordConfirmModal(async (password) => {
            try {
                await reauthenticate(password);
                await deleteDoc(doc(db, 'users', user.uid));
                await deleteUser(user);
                showToast(t('toast.delete.ok'));
            } catch (err) {
                showToast('❌ ' + friendlySettingsError(err.code));
            }
        });
    } else {
        try {
            await reauthenticate();
            await deleteDoc(doc(db, 'users', user.uid));
            await deleteUser(user);
            showToast(t('toast.delete.ok'));
        } catch (err) {
            showToast('❌ ' + friendlySettingsError(err.code));
        }
    }
}

// ── Email verified bonus ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  FIX: Previously this used userData.gold passed from the caller, which could
//  be stale or 0 if userData hadn't fully loaded. Now we:
//    1. Reload the Firebase auth user so emailVerified is always fresh.
//    2. Read the Firestore document directly to get the real current gold value.
//    3. Use Firestore increment() so the write is atomic — no race conditions.
// ─────────────────────────────────────────────────────────────────────────────
export async function checkAndGrantVerifiedBonus(uid) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        // Force-refresh the auth token so emailVerified reflects the latest state
        await user.reload();

        if (!user.emailVerified) return false;

        // Read fresh from Firestore — don't trust the in-memory userData
        const ref  = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return false;

        const fresh = snap.data();

        // Already granted — don't give it again
        if (fresh.emailVerifiedBonus === true) return false;

        // Atomically add 50 gold regardless of what the caller had in memory
        await updateDoc(ref, {
            gold:               increment(50),
            emailVerifiedBonus: true,
            lastActivity:       serverTimestamp(),
        });

        showToast('✨ E-mail verificat! +50 💰 Aur bonus!');
        return true;

    } catch (err) {
        console.error('[checkAndGrantVerifiedBonus]', err);
        return false;
    }
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function showConfirmModal({ icon, title, message, confirmText, confirmClass, onConfirm }) {
    document.getElementById('settingsConfirmModal')?.remove();

    const modal = document.createElement('div');
    modal.id        = 'settingsConfirmModal';
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = `
    <div class="settings-modal">
      <div class="settings-modal-icon">${icon}</div>
      <h3 class="settings-modal-title">${title}</h3>
      <p class="settings-modal-msg">${message}</p>
      <div class="settings-modal-actions">
        <button class="settings-btn settings-btn--ghost" id="modalCancelBtn">${t('settings.cancel')}</button>
        <button class="settings-btn ${confirmClass}"     id="modalConfirmBtn">${confirmText}</button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));

    document.getElementById('modalCancelBtn').addEventListener('click', () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300);
    });
    document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
        document.getElementById('modalConfirmBtn').disabled    = true;
        document.getElementById('modalConfirmBtn').textContent = t('settings.processing');
        await onConfirm();
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300);
    });
    modal.addEventListener('click', e => {
        if (e.target === modal) { modal.classList.remove('visible'); setTimeout(() => modal.remove(), 300); }
    });
}

// ── Password re-auth modal ────────────────────────────────────────────────────
function showPasswordConfirmModal(onConfirm) {
    document.getElementById('settingsConfirmModal')?.remove();

    const modal = document.createElement('div');
    modal.id        = 'settingsConfirmModal';
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = `
    <div class="settings-modal">
      <div class="settings-modal-icon">🔐</div>
      <h3 class="settings-modal-title">${t('settings.reauth.title')}</h3>
      <p class="settings-modal-msg">${t('settings.reauth.msg')}</p>
      <input type="password" id="reAuthPasswordInput" class="rpg-input"
             placeholder="${t('settings.reauth.placeholder')}" style="margin:12px 0;" />
      <div class="settings-modal-actions">
        <button class="settings-btn settings-btn--ghost" id="modalCancelBtn">${t('settings.cancel')}</button>
        <button class="settings-btn settings-btn--red"   id="modalConfirmBtn">${t('settings.reauth.btn')}</button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));

    document.getElementById('modalCancelBtn').addEventListener('click', () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300);
    });
    document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
        const pwd = document.getElementById('reAuthPasswordInput').value;
        if (!pwd) return showToast(t('toast.otp.enter'));
        document.getElementById('modalConfirmBtn').disabled    = true;
        document.getElementById('modalConfirmBtn').textContent = t('settings.verifying');
        await onConfirm(pwd);
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300);
    });
    modal.addEventListener('click', e => {
        if (e.target === modal) { modal.classList.remove('visible'); setTimeout(() => modal.remove(), 300); }
    });
}

// ── Error messages ────────────────────────────────────────────────────────────
function friendlySettingsError(code) {
    const map = {
        'auth/wrong-password':        'Parola actuală este greșită.',
        'auth/weak-password':         'Parola nouă trebuie să aibă minim 6 caractere.',
        'auth/requires-recent-login': 'Sesiunea a expirat. Deconectează-te și reconectează-te.',
        'auth/too-many-requests':     'Prea multe încercări. Încearcă mai târziu.',
        'auth/invalid-credential':    'Credențiale invalide. Verifică parola.',
    };
    return map[code] || 'A apărut o eroare. Încearcă din nou.';
}