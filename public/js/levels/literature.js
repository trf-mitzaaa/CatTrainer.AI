// js/literature.js
// ─────────────────────────────────────────────────────────────────────────────
//  LITERATURE REALM
//  To add a level: push a new object into the `levels` array below.
//  To remove a level: delete or comment out its object.
// ─────────────────────────────────────────────────────────────────────────────

export const LITERATURE = {
    key: 'literature',
    name: 'Literatură',
    icon: '📚',
    color: '#c0392b',
    levels: [
        {
            type: 'lesson',
            title: 'Bazele Literaturii',
            icon: '📚',
            topic: 'genuri literare, narator, personaje',
        },
        {
            type: 'enemy',
            title: 'Goblinul Poeziei',
            icon: '🪶',
            enemy: '🪶 Goblinul Poeziei',
            topic: 'rimă, ritm, figuri de stil',
        },
        {
            type: 'enemy',
            title: 'Spectrul Romanului',
            icon: '👻',
            enemy: '👻 Spectrul Romanului',
            topic: 'roman, conflict, perspectivă narativă',
        },
        {
            type: 'enemy',
            title: 'Trolul Dramaturgiei',
            icon: '🎭',
            enemy: '🎭 Trolul Dramaturgiei',
            topic: 'teatru, dialog, acte și scene',
        },
        {
            type: 'boss',
            title: 'Dragonul Clasicilor',
            icon: '🐉',
            enemy: '🐉 Dragonul Clasicilor',
            topic: 'autori clasici, curente literare',
        },
    ],
};