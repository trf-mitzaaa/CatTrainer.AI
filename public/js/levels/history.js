// js/history.js
// ─────────────────────────────────────────────────────────────────────────────
//  HISTORY REALM
//  To add a level: push a new object into the `levels` array below.
//  To remove a level: delete or comment out its object.
// ─────────────────────────────────────────────────────────────────────────────

export const HISTORY = {
    key:   'history',
    name:  'Istorie',
    icon:  '🏛️',
    color: '#8e44ad',
    levels: [
        {
        type: 'lesson',
        title: 'Bazele Istoriei',
        icon: '📜',
        topic: 'cronologie, epoci istorice, surse istorice',
    },
    {
        type: 'enemy',
        title: 'Goblinul Antichității',
        icon: '⚔️',
        enemy: '⚔️ Goblinul Antichității',
        topic: 'Egiptul Antic, Grecia, Roma',
    },
    {
        type: 'lesson',
        title: 'Academia Imperiilor',
        icon: '🏛️',
        topic: 'imperii antice, conducători, expansiune',
    },
    {
        type: 'enemy',
        title: 'Spectrul Medieval',
        icon: '🏰',
        enemy: '🏰 Spectrul Medieval',
        topic: 'evul mediu, cavaleri, feudalism',
    },
    {
        type: 'enemy',
        title: 'Trolul Revoluțiilor',
        icon: '🔥',
        enemy: '🔥 Trolul Revoluțiilor',
        topic: 'revoluția franceză, industrializare',
    },
    {
        type: 'lesson',
        title: 'Fronturile Lumii Moderne',
        icon: '🪖',
        topic: 'primul și al doilea război mondial',
    },
    {
        type: 'enemy',
        title: 'Fantoma Războiului Rece',
        icon: '❄️',
        enemy: '❄️ Fantoma Războiului Rece',
        topic: 'NATO, URSS, conflicte ideologice',
    },
    {
        type: 'boss',
        title: 'Dragonul Imperiilor',
        icon: '🐉',
        enemy: '🐉 Dragonul Imperiilor',
        topic: 'imperii mondiale, războaie, expansiune',
    },
    ],
};