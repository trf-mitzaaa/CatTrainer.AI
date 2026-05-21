// js/math.js
// ─────────────────────────────────────────────────────────────────────────────
//  MATH REALM
//  To add a level: push a new object into the `levels` array below.
//  To remove a level: delete or comment out its object.
// ─────────────────────────────────────────────────────────────────────────────

export const MATH = {
    key: 'math',
    name: 'Matematică',
    icon: '📐',
    color: '#2980b9',
    levels: [
        {
            type: 'lesson',
            title: 'Bazele Numerelor',
            icon: '📐',
            topic: 'numere naturale, întregi, operații de bază',
        },
        {
            type: 'enemy',
            title: 'Goblinul Ecuațiilor',
            icon: '➗',
            enemy: '➗ Goblinul Ecuațiilor',
            topic: 'ecuații simple, necunoscute, rezolvare',
        },
        {
            type: 'enemy',
            title: 'Spectrul Geometriei',
            icon: '📏',
            enemy: '📏 Spectrul Geometriei',
            topic: 'forme geometrice, unghiuri, arii',
        },
        {
            type: 'enemy',
            title: 'Trolul Funcțiilor',
            icon: '📈',
            enemy: '📈 Trolul Funcțiilor',
            topic: 'funcții, grafice, relații matematice',
        },
        {
            type: 'boss',
            title: 'Dragonul Calculului',
            icon: '🐉',
            enemy: '🐉 Dragonul Calculului',
            topic: 'limite, derivate, integrale',
        },
    ],
};