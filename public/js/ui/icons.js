// ~~~~~~~~~~~~~~~~~~~~
// ICONIȚE!!! acest script înlocuiește toate (aproape toate) iconițele de tip emoji cu imagini.
// ~~~~~~~~~~~~~~~~~~~~

const ICON_PATH = 'assets/icons/';
 
export const ICONS = {
  home:           'home.png',
  map:            'map.png',
  profile:        'profile.png',
  inventory:      'inventory.png',
  missions:       'missions.png',
  clan:           'clan.png',
  shop:           'shop.png',
  gold:           'gold.png',
  xp:             'xp.png',
  sound_on:       'sound-on.png',
  sound_off:      'sound-off.png',
  logout:         'logout.png',
  chest_common:   'chest-common.png',
  chest_rare:     'chest-rare.png',
  chest_epic:     'chest-epic.png',
};
 
export function iconHTML(name, fallbackEmoji, cls = '') {
  const file = ICONS[name];
  if (!file) return fallbackEmoji;
  return `<img class="ui-icon ${cls}" src="${ICON_PATH}${file}" data-fb="${fallbackEmoji}" alt="">`;
}

export function initIconFallbacks() {
  const toEmoji = (img) => {
    const fb = img.dataset.fb || '❔';
    img.replaceWith(document.createTextNode(fb));
  };
 

  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.classList.contains('ui-icon')) return;
    toEmoji(img);
  }, true);

  const sweep = () => {
    document.querySelectorAll('img.ui-icon').forEach(img => {
      if (img.complete && img.naturalWidth === 0) toEmoji(img);
    });
  };
  sweep();
  window.addEventListener('load', sweep);
}

export const EMOJI_FILES = {
  '🧬': 'biology.png',     
  '🔢': 'numbers.png',      
  '📐': 'math.png',       
  '🏛️': 'history.png',       
  '⚗️': 'chemistry.png',   
  '🔭': 'physics.png',
  '💻': 'computerscience.png',   
  '📚': 'literature.png',    
  '🧰': 'chest.png',    
  '🎁': 'chest2.png', 
  '👝': 'chest3.png',
  '💰': 'coin.png', 
  '❤️‍🔥': 'inimadefier.gif',
  '🧪': 'potiuneviata.png',
  '⚡': 'pergamentfulger.webp',
  '🎲': 'dice.webp',
  '🔮': 'nucleu.webp',
  '🗡️': 'lama.webp',
  '💎': 'piatra.gif',
  '🛡️': 'scut.png',
  '🪞': 'oglinda.webp',
  '📘': 'orb.webp',
  '📜': 'tome.webp',
  '😸': 'amuleta.webp',
  '🪙': 'coin.webp',
  '🔔': 'missions.png',
  '📀': 'coin2.gif',
};

export function emojiIcon(emoji, cls = '') {
  const file = EMOJI_FILES[emoji];
  if (!file) return emoji;
  return `<img class="ui-icon ui-icon--em ${cls}" src="assets/icons/${file}" data-fb="${emoji}" alt="">`;
}