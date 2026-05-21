// js/computerscience.js
// ─────────────────────────────────────────────────────────────────────────────
//  COMPUTER SCIENCE REALM
//  To add a level: push a new object into the `levels` array below.
//  To remove a level: delete or comment out its object.
// ─────────────────────────────────────────────────────────────────────────────

export const COMPUTERSCIENCE = {
    key:   'computerscience',
    name:  'Informatică',
    icon:  '💻',
    color: '#00838f',
    levels: [
        {
        type: 'lesson',
        title: 'Bazele Calculatorului',
        icon: '💻',
        topic: 'hardware, software, componentele calculatorului',
    },
    {
        type: 'enemy',
        title: 'Goblinul Algoritmilor',
        icon: '🤖',
        enemy: '🤖 Goblinul Algoritmilor',
        topic: 'algoritmi, pași logici, rezolvare de probleme',
    },
    {
        type: 'lesson',
        title: 'Turnul Variabilelor',
        icon: '📦',
        topic: 'variabile, constante, tipuri de date',
    },
    {
        type: 'enemy',
        title: 'Spectrul Variabilelor',
        icon: '👾',
        enemy: '👾 Spectrul Variabilelor',
        topic: 'input, output, memorarea datelor',
    },
    {
        type: 'enemy',
        title: 'Trolul Codului',
        icon: '🔁',
        enemy: '🔁 Trolul Codului',
        topic: 'bazele codarii, C++, JavaScript',
    },
    {
        type: 'lesson',
        title: 'Peștera Funcțiilor',
        icon: '🧩',
        topic: 'funcții, parametri, reutilizarea codului',
    },
    {
        type: 'enemy',
        title: 'Cavalerul Debuggingului',
        icon: '🛠️',
        enemy: '🛠️ Cavalerul Debuggingului',
        topic: 'erori, debugging, testare',
    },
    {
        type: 'boss',
        title: 'Dragonul Programării',
        icon: '🐉',
        enemy: '🐉 Dragonul Programării',
        topic: 'logică avansată, structurarea codului',
    },
    ],
};