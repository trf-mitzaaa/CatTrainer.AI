🐱 CatTrainer.AI

> **Platformă educațională gamificată cu Inteligență Artificială**  
> Învață. Explorează. Cucerește.

[![Firebase Hosting](https://img.shields.io/badge/Hosting-Firebase-orange?logo=firebase)](https://firebase.google.com)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-blue?logo=google)](https://ai.google.dev)
[![InfoEducație](https://img.shields.io/badge/Concurs-InfoEduca%C8%9Bie%202025-green)](https://infoeducatie.ro)

---

## 📖 Despre Proiect

**CatTrainer.AI** este o aplicație web educațională care transformă studiul într-un joc RPG. Elevul devine un erou care explorează **7 Tărâmuri ale Cunoștinței**, studiază lecții generate de AI, înfruntă inamici prin întrebări și câștigă recompense.

Fiecare lecție și fiecare întrebare sunt generate **dinamic** de Google Gemini 2.5 Flash, adaptate clasei, vârstei, limbii și obiectivelor fiecărui utilizator — nicio sesiune nu este identică.

> Proiect realizat de elevi de la **Liceul Teoretic „Emil Racoviță" Baia Mare**  
> pentru concursul **InfoEducație 2025**, secțiunea Software Educațional.  
> Coordonator: **Prof. Muntean Rareș Mircea**  
> Autori: **Trif Mihai-Alexandru** & **Boejete Erik**, clasa a XI-a

---

## ✨ Funcționalități

| Funcționalitate | Detalii |
|---|---|
| 🤖 **AI Game Master** | Lecții și întrebări generate live de Gemini 2.5 Flash |
| ⚔️ **Sistem de Bătălie** | HP, daune, streak bonus, animații, Boss final |
| 🗺️ **7 Tărâmuri** | Biologie, Matematică, Istorie, Chimie, Fizică, Literatură, Informatică |
| 🎮 **Gamificare completă** | XP, nivele eroice, aur, magazin, realizări deblocabile |
| 🧪 **6 Power-Up-uri** | Poțiuni, scuturi, indicii, pergamente XP |
| 🌍 **5 Limbi** | Română, Engleză, Franceză, Germană, Spaniolă |
| 📱 **Responsive** | Funcționează pe desktop, tabletă și mobil |
| 🔐 **Autentificare** | Google, Email/Parolă, Telefon (OTP) |

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5 / CSS3 / JavaScript ES Modules
- **Backend:** Node.js + Express (server static)
- **Bază de date:** Firebase Firestore (NoSQL cloud)
- **Autentificare:** Firebase Authentication
- **AI:** Google Gemini 2.5 Flash Lite
- **Hosting:** Firebase Hosting + GitHub Actions CI/CD

---

## 🚀 Instalare Rapidă

### Cerințe
- Node.js ≥ 18.0.0
- Cont Firebase (gratuit)
- Cheie API Google Gemini (gratuită)

### Pași

```bash
# 1. Clonează repo-ul
git clone https://github.com/[username]/cattrainer-ai
cd cattrainer-ai

# 2. Instalează dependențele
npm install

# 3. Configurează Firebase
# Creează fișierul public/js/firebase-config.js cu datele din Firebase Console
# (vezi secțiunea Configurare de mai jos)

# 4. Configurează cheia Gemini API
# Înlocuiește GEMINI_API_KEY în public/js/battle.js

# 5. Pornește serverul local
npm run dev
# Accesează http://localhost:3000
```

### Configurare Firebase (`public/js/firebase-config.js`)

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
```

### Deploy pe Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy
```

---

## 🗂️ Structura Proiectului

```
cattrainer-ai/
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   └── responsive.css
│   └── js/
│       ├── main.js          # Orchestrator principal
│       ├── auth.js          # Firebase Authentication
│       ├── db.js            # Operații Firestore
│       ├── game.js          # Date statice joc
│       ├── battle.js        # Logica bătăliei + Gemini API
│       ├── ui.js            # Funcții render UI
│       ├── onboarding.js    # Wizard personalizare
│       ├── settings.js      # Setări cont
│       ├── powerups.js      # Definiții power-up-uri
│       ├── i18n.js          # Multilingvism (5 limbi)
│       └── levels/
│           ├── biology.js
│           ├── math.js
│           ├── history.js
│           ├── chemistry.js
│           ├── physics.js
│           ├── literature.js
│           └── computerscience.js
├── server.js                # Server Node.js + Express
├── firebase.json
├── firestore.rules
└── package.json
```

---

## 🎮 Cum Funcționează

```
Login / Înregistrare
        ↓
Onboarding (5 pași: vârstă, clasă, materii, limbă, scop)
        ↓
Harta Lumii (7 Tărâmuri)
        ↓
Harta Nivelelor (Lecție → Inamici × 3 → Boss)
        ↓
Bătălie: Studiezi lecția AI → Răspunzi la întrebări AI
        ↓
Victorie: XP + Aur → Magazin → Power-Up-uri → Realizări
```

---

## 🤝 Contribuții

Proiectul este open-source. Pull request-urile sunt binevenite!

Pentru a adăuga un **tărâm nou**:
1. Creează `public/js/levels/numeMaterie.js` după templateul existent
2. Adaugă un import în `public/js/game.js`

---

---

<div align="center">
  <sub>Construit cu ❤️ la Liceul Teoretic „Emil Racoviță" Baia Mare</sub>
</div>
