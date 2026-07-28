import { auth } from './firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { initUserData } from './db.js';
import { showToast } from '../ui/ui.js';

let confirmationResult = null;

// ~~~~~~~~~ listener pentru autentificare ~~~~~~~~~~
export function listenAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await initUserData(user);
      onLogin(user);
    } else {
      onLogout();
    }
  });
}

// ~~~~~~~~~ intrăm cu google ~~~~~~~~~~
export async function googleSignIn() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    showToast('Bine ai venit!, ' + result.user.displayName + '!');
    if (result._tokenResponse?.isNewUser) {
      window.__catNewUser = true;
    }
    return result.user;
  } catch (err) {
    showToast('❌ ' + err.message);
    throw err;
  }
}

// ~~~~~~~~~ ne facem cont cu E-Mail ~~~~~~~~~~
export async function emailRegister(name, email, password) {
  try {
    window.__catNewUser = true;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    showToast('Cont creat! Bine ai venit, ' + name + '!');
    return cred.user;
  } catch (err) {
    window.__catNewUser = false;
    showToast('❌ ' + friendlyError(err.code));
    throw err;
  }
}

// ~~~~~~~~~ dacă vrem vreodată să ne schimbăm numele ~~~~~~~~~~
export async function changeDisplayName(newName) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nu ești autentificat.');
  await updateProfile(user, { displayName: newName });
  return newName;
}

// ~~~~~~~~~ intrăm cu E-Mail ~~~~~~~~~~
export async function emailLogin(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    showToast('⚔️ Bine ai revenit, eroule!');
    return cred.user;
  } catch (err) {
    showToast('❌ ' + friendlyError(err.code));
    throw err;
  }
}

// ~~~~~~~~~ intrăm cu telefon (nefolosit, dar totuși păstrat în caz de orice)~~~~~~~~~~
export async function setupRecaptcha(elementId) {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
      size: 'invisible',
      callback: () => {}
    });
    await window.recaptchaVerifier.render();
  }
}

export async function sendOtp(phoneNumber) {
  try {
    await setupRecaptcha('recaptcha-container');
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
    showToast('📱 Codul secret a fost trimis!');
    return true;
  } catch (err) {
    showToast('❌ ' + err.message);
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    throw err;
  }
}

export async function verifyOtp(otp) {
  try {
    if (!confirmationResult) throw new Error('No OTP sent');
    const cred = await confirmationResult.confirm(otp);
    showToast('✨ Crystal ball verified! Welcome!');
    return cred.user;
  } catch (err) {
    showToast('❌ Wrong rune code! Try again.');
    throw err;
  }
}

// ~~~~~~~~~ ieșim din cont ~~~~~~~~~~
export async function logout() {
  await signOut(auth);
  showToast('🚪 Pe data viitoare, eroule!');
}

// ~~~~~~~~~ erori ~~~~~~~~~~
function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'Acest e-mail este deja folosit de către cineva!',
    'auth/invalid-email':        'E-Mail invalid.',
    'auth/weak-password':        'Parola ta trebuie să aibă minim 6 caractere!',
    'auth/user-not-found':       'Nu s-a găsit un user pentru acest E-Mail.',
    'auth/wrong-password':       'Parolă greșită! Mai încearcă o dată.',
    'auth/too-many-requests':    'Trimiți prea multe request-uri! Calmează-te!',
  };
  return map[code] || 'Unknown error...'; // dacă nu știm tipul erorii
}