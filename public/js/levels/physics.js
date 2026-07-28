// js/physics.js

export const PHYSICS = {
    key: 'physics',
    name: 'Fizică',
    icon: '🔭',
    color: '#16a085',
    levels: [
        {
            type: 'lesson',
            title: 'Bazele Fizicii',
            icon: '⚛️',
            topic: 'mărimi fizice, unități de măsură, mișcare',
        },
        {
            type: 'enemy',
            title: 'Goblinul Forțelor',
            icon: '🪨',
            enemy: '🪨 Goblinul Forțelor',
            topic: 'forțe, legile lui Newton, accelerație',
        },
        {
            type: 'enemy',
            title: 'Spectrul Energiei',
            icon: '⚡',
            enemy: '⚡ Spectrul Energiei',
            topic: 'energie cinetică, potențială, conservare',
        },
        {
            type: 'enemy',
            title: 'Trolul Electricității',
            icon: '🔋',
            enemy: '🔋 Trolul Electricității',
            topic: 'curent electric, tensiune, rezistență',
        },
        {
            type: 'boss',
            title: 'Dragonul Universului',
            icon: '🌌',
            enemy: '🌌 Dragonul Universului',
            topic: 'gravitație, galaxii, teoria relativității',
        },
    ],
};