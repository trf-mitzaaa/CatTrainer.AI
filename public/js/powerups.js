// js/powerups.js
// ─────────────────────────────────────────────────────────────────────────────
//  CatTrainer RPG — Power-up Registry
//
//  This is the ONLY file you need to edit to add, remove, or modify power-ups.
//
//  Each power-up has:
//    id       — unique string key
//    type     — 'consumable' | 'persistent'
//    icon, name, desc, price, tooltip
//
//  Consumables:  action(battleManager, ctx) — return true if used successfully
//  Persistent:   apply(battleManager)       — mutate bm.buffs on construction
//
//  ctx = { showToast, updateHpDisplay, rerenderBar, eliminateAnswer }
//
//  ── Adding a new power-up ────────────────────────────────────────────────────
//  1. Add entry to POWERUPS below.
//  2. If it needs a new buff field, add the default in BattleManager.buffs
//     inside battle.js and check it in answerQuestion().
// ─────────────────────────────────────────────────────────────────────────────

export const POWERUPS = [

    // ══ CONSUMABLES ══════════════════════════════════════════════════════════════

    {
        id: 'hp_potion',
        type: 'consumable',
        icon: '🧪',
        name: 'Poțiune HP',
        desc: 'Restaurează 30 HP în luptă',
        price: 50,
        tooltip: 'Clic pentru a recupera 30 HP imediat',
        action(bm, { showToast, updateHpDisplay, rerenderBar }) {
            if (!bm.consumables.hp_potion) {
                showToast('🧪 Poțiunea a fost deja folosită!');
                return false;
            }
            const used = bm.useHpPotion();
            if (used) { updateHpDisplay(); rerenderBar(); }
            return used;
        },
    },

    {
        id: 'hint_stone',
        type: 'consumable',
        icon: '💎',
        name: 'Piatra Indiciului',
        desc: 'Elimină un răspuns greșit din întrebare',
        price: 60,
        tooltip: 'Clic pentru a elimina un răspuns greșit',
        action(bm, { showToast, eliminateAnswer, rerenderBar }) {
            if (!bm.consumables.hint_stone) {
                showToast('💎 Piatra a fost deja folosită!');
                return false;
            }
            const idx = bm.useHintStone();
            if (idx === -1) {
                showToast('💎 Nu se poate folosi acum!');
                return false;
            }
            eliminateAnswer(idx);
            rerenderBar();
            return true;
        },
    },

    {
        id: 'shield',
        type: 'consumable',
        icon: '🛡️',
        name: 'Scut Magic',
        desc: 'Blochează penalizarea unui răspuns greșit',
        price: 100,
        tooltip: 'Activ automat — blochează primul atac',
        passive: true,
        action() { return false; },
    },

    {
        id: 'lightning_scroll',
        type: 'consumable',
        icon: '⚡',
        name: 'Pergament Fulger',
        desc: 'Următorul răspuns corect provoacă damage critic',
        price: 95,
        tooltip: 'Clic — următorul atac va fi critic',
        action(bm, { showToast, rerenderBar }) {
            if (!bm.consumables.lightning_scroll) {
                showToast('⚡ Pergamentul a fost deja folosit!');
                return false;
            }
            bm.buffs.nextAttackCritical = true;
            bm.consumables.lightning_scroll = false;
            rerenderBar();
            showToast('⚡ Următorul atac va fi critic!');
            return true;
        },
    },

    {
        id: 'mirror_shard',
        type: 'consumable',
        icon: '🪞',
        name: 'Ciobul Oglinzii',
        desc: 'Reflectă o greșeală — nu primești damage',
        price: 120,
        tooltip: 'Activ automat — anulează o penalizare',
        // Passive like shield — auto-triggers on wrong answer
        passive: true,
        action() { return false; },
    },

    {
        id: 'chaos_dice',
        type: 'consumable',
        icon: '🎲',
        name: 'Zarul Haosului',
        desc: 'Random: heal, damage bonus sau eliminare răspuns',
        price: 75,
        tooltip: 'Clic — efect aleatoriu',
        action(bm, { showToast, updateHpDisplay, eliminateAnswer, rerenderBar }) {
            if (!bm.consumables.chaos_dice) {
                showToast('🎲 Zarul a fost deja folosit!');
                return false;
            }
            const roll = Math.floor(Math.random() * 3);
            if (roll === 0) {
                bm.playerHP = Math.min(bm.playerMax, bm.playerHP + 20);
                updateHpDisplay();
                showToast('💚 Zaruri bune! +20 HP recuperat!');
            } else if (roll === 1) {
                bm.buffs.doubleNextAttack = true;
                showToast('⚔️ Zaruri nebune! Următorul atac este dublu!');
            } else {
                const idx = bm.useHintStone?.();
                if (idx !== undefined && idx !== -1) {
                    eliminateAnswer(idx);
                    showToast('❌ Zaruri haotice! Un răspuns greșit a dispărut!');
                } else {
                    // Fallback if hint already used — small heal instead
                    bm.playerHP = Math.min(bm.playerMax, bm.playerHP + 10);
                    updateHpDisplay();
                    showToast('💚 Zaruri confuze! +10 HP de consolare!');
                }
            }
            bm.consumables.chaos_dice = false;
            rerenderBar();
            return true;
        },
    },

    // ══ PERSISTENT BUFFS ═════════════════════════════════════════════════════════

    {
        id: 'xp_boost',
        type: 'persistent',
        icon: '📜',
        name: 'Pergament XP',
        desc: 'Câștigă 1.5× XP în fiecare bătălie',
        price: 80,
        tooltip: '1.5× XP la victorie',
        apply(bm) { bm.buffs.xpMult = 1.5; },
    },

    {
        id: 'cat_charm',
        type: 'persistent',
        icon: '🐱',
        name: 'Amuletă Pisică Norocoasă',
        desc: 'Răspunsurile greșite dau jumătate de daune',
        price: 120,
        tooltip: '½ daune la greșeală',
        apply(bm) { bm.buffs.halfDamage = true; },
    },

    {
        id: 'time_hourglass',
        type: 'persistent',
        icon: '⏳',
        name: 'Clepsidra Timpului',
        desc: 'Arată răspunsul corect după o greșeală',
        price: 70,
        tooltip: 'Dezvăluie răspunsul corect după greșeală',
        apply(bm) { bm.buffs.hintOnWrong = true; },
    },

    {
        id: 'mage_core',
        type: 'persistent',
        icon: '🔮',
        name: 'Nucleul Magului',
        desc: 'Toate efectele consumabile sunt mai puternice (+50%)',
        price: 220,
        tooltip: '+50% eficiență consumabile',
        apply(bm) { bm.buffs.strongConsumables = true; },
    },

    {
        id: 'iron_heart',
        type: 'persistent',
        icon: '❤️‍🔥',
        name: 'Inima de Fier',
        desc: 'Crește HP-ul maxim cu 25',
        price: 180,
        tooltip: '+25 HP maxim',
        apply(bm) {
            bm.playerMax += 25;
            bm.playerHP += 25;
        },
    },

    {
        id: 'assassin_blade',
        type: 'persistent',
        icon: '🗡️',
        name: 'Lama Asasinului',
        desc: 'Prima lovitură din fiecare luptă este critică',
        price: 175,
        tooltip: 'Primul atac = critic automat',
        apply(bm) { bm.buffs.firstAttackCrit = true; },
    },

    {
        id: 'knowledge_orb',
        type: 'persistent',
        icon: '📘',
        name: 'Orbul Cunoașterii',
        desc: 'Primești XP chiar și când pierzi',
        price: 150,
        tooltip: 'XP la înfrângere',
        apply(bm) { bm.buffs.loseXpReward = true; },
    },

    {
        id: 'lucky_coin',
        type: 'persistent',
        icon: '🪙',
        name: 'Moneda Norocoasă',
        desc: '25% șansă să nu consumi itemul folosit',
        price: 200,
        tooltip: '25% șansă de refund la consumabile',
        apply(bm) { bm.buffs.itemRefundChance = 0.25; },
    },

];

// ── Derived lookups ───────────────────────────────────────────────────────────

export const CONSUMABLE_ITEMS = POWERUPS
    .filter(p => p.type === 'consumable')
    .map(p => p.id);

export const PERSISTENT_ITEMS = POWERUPS
    .filter(p => p.type === 'persistent')
    .map(p => p.id);

export const ACTIVE_CONSUMABLES = POWERUPS
    .filter(p => p.type === 'consumable' && !p.passive)
    .map(p => p.id);

export const PASSIVE_CONSUMABLES = POWERUPS
    .filter(p => p.type === 'consumable' && p.passive)
    .map(p => p.id);

export const POWERUP_MAP = Object.fromEntries(POWERUPS.map(p => [p.id, p]));

export function getShopItemsFromPowerups() {
    return POWERUPS.map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        desc: p.desc,
        price: p.price,
        effect: {},
    }));
}