// js/chemistry.js
// ─────────────────────────────────────────────────────────────────────────────
//  CHEMISTRY REALM
//  To add a level: push a new object into the `levels` array below.
//  To remove a level: delete or comment out its object.
//  Level shape:
//    {
//      type  : 'lesson' | 'enemy' | 'boss'
//      title : string
//      icon  : string emoji
//      topic : string   ← sent verbatim to the AI — be specific!
//      enemy : string (optional)
//    }
// ─────────────────────────────────────────────────────────────────────────────

export const CHEMISTRY = {
    key:   'chemistry',
    name:  'Chimie',
    icon:  '⚗️',
    color: '#e67e22',
    levels: [
        {
        type: 'lesson',
        title: 'Bazele Atomului',
        icon: '⚗️',
        topic: 'bazele atomului, structura atomului, protoni, neutroni, electroni',
    },
    {
        type: 'enemy',
        title: 'Goblinul Tabelului Periodic',
        icon: '🧪',
        enemy: '🧪 Goblinul Tabelului Periodic',
        topic: 'elemente chimice, grupe, perioade',
    },
    {
        type: 'lesson',
        title: 'Alchimia Moleculelor',
        icon: '🧬',
        topic: 'molecule, compuși, formule chimice',
    },
    {
        type: 'enemy',
        title: 'Spectrul Legăturilor',
        icon: '👻',
        enemy: '👻 Spectrul Legăturilor',
        topic: 'legături ionice, covalente, metalice',
    },
    {
        type: 'enemy',
        title: 'Trolul Reacțiilor',
        icon: '🔥',
        enemy: '🔥 Trolul Reacțiilor',
        topic: 'reacții chimice, reactanți, produși',
    },
    {
        type: 'lesson',
        title: 'Laboratorul Soluțiilor',
        icon: '🧫',
        topic: 'soluții, concentrații, dizolvare',
    },
    {
        type: 'enemy',
        title: 'Vrăjitorul Acizilor',
        icon: '☠️',
        enemy: '☠️ Vrăjitorul Acizilor',
        topic: 'acizi, baze, scala pH',
    },
    {
        type: 'boss',
        title: 'Dragonul Chimiei Organice',
        icon: '🐉',
        enemy: '🐉 Dragonul Chimiei Organice',
        topic: 'hidrocarburi, alcani, compuși organici',
    },
    ],
};