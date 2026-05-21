# 🐱 CatTrainer RPG

> **The Grand Learning Realm** — An AI-powered educational RPG where Professor Whiskers (a cat Game Master) guides you through epic knowledge battles!

---

## ✨ Features

- 🗺️ **World Map** — 6 subject realms (Biology, Math, History, Chemistry, Physics, Literature)
- ⚔️ **RPG Battle System** — Lesson → Enemy fights → Boss battles
- 🤖 **AI Game Master** — Gemini 1.5 Flash generates lessons & questions dynamically
- 🐱 **Cat Aesthetic** — Professor Whiskers narrates everything with cat puns
- 👤 **Auth** — Google, Email/Password, Phone (OTP) via Firebase
- 💰 **Economy** — Earn gold from battles, spend in the Mewchant's Bazaar
- 📊 **Account Page** — Stats, achievements, realm progress
- 🏆 **Achievement System** — Unlock badges as you progress
- ✨ **Animations** — Floating paw prints, particles, spell effects, battle animations

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication** → Sign-in methods:
   - ✅ Google
   - ✅ Email/Password
   - ✅ Phone
4. Enable **Firestore Database** (start in test mode initially)
5. Copy your project config from **Project Settings → Your apps → Firebase SDK snippet**

### 3. Set Up Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Enable the Gemini API in your Google Cloud project

### 4. Configure the App

**`js/firebase-config.js`** — Replace all placeholder values:
```js
const firebaseConfig = {
  apiKey:            "YOUR_FIREBASE_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

**`js/battle.js`** — Replace the Gemini key:
```js
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
```

### 5. Structure for Node.js Server

Place all web files inside a `public/` folder:
```
cattrainer/
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── main.css
│   │   └── animations.css
│   └── js/
│       ├── firebase-config.js
│       ├── auth.js
│       ├── db.js
│       ├── game.js
│       ├── battle.js
│       ├── ui.js
│       └── main.js
├── server.js
├── package.json
├── firebase.json
└── firestore.rules
```

### 6. Run the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (select your project)
firebase init hosting

# Deploy
firebase deploy
```

---

## 🎮 Game Structure

### Subject Realms
Each realm has 5 levels:

| Level | Type   | Description                          | Reward       |
|-------|--------|--------------------------------------|--------------|
| 1     | Lesson | Study the topic with AI-generated content | +20 XP  |
| 2-4   | Enemy  | Answer 3 questions in battle format  | +40 XP, +25💰 |
| 5     | Boss   | 5-question final battle, more HP     | +100 XP, +75💰 |

### Progression
- Levels must be completed in order
- Boss unlocks after completing all previous levels
- Each subject realm tracks progress independently

### Level & XP
- 100 XP = 1 Level
- Level unlocks: higher class titles (Novice → Scholar → Arcane Master)

---

## 🔐 Firebase Security Rules

Deploy your Firestore rules:
```bash
firebase deploy --only firestore:rules
```

The rules ensure each user can only access their own data.

---

## 🛠️ Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | Vanilla HTML/CSS/JS (ES Modules)  |
| Backend    | Node.js + Express                 |
| Database   | Firebase Firestore                |
| Auth       | Firebase Authentication           |
| AI         | Google Gemini 1.5 Flash API       |
| Hosting    | Firebase Hosting (optional)       |

---

## 📁 File Overview

| File                  | Purpose                                      |
|-----------------------|----------------------------------------------|
| `index.html`          | Main app shell, all screens/overlays         |
| `css/main.css`        | Full RPG theme, layout, components           |
| `css/animations.css`  | All keyframe animations                      |
| `js/firebase-config.js` | Firebase init (put your keys here)         |
| `js/auth.js`          | All auth methods (Google/Email/Phone)        |
| `js/db.js`            | Firestore read/write helpers                 |
| `js/game.js`          | Game data: subjects, items, achievements     |
| `js/battle.js`        | Gemini AI integration, battle state machine  |
| `js/ui.js`            | UI helpers, animations, toasts               |
| `js/main.js`          | App orchestrator, all event bindings         |
| `server.js`           | Express static server                        |
| `firestore.rules`     | Firestore security rules                     |
| `firebase.json`       | Firebase hosting config                      |

---

## 🐱 Professor Whiskers says...

*"May your knowledge be vast and your HP never reach zero! Meow! 🐾"*
