export const PHASES = ['economy', 'technology', 'military'];
export const AGES = ['dark', 'feudal', 'castles', 'imperial'];
export const AGE_PRODUCTION_LIMIT = { dark: 2, feudal: 3, castles: 4, imperial: 5 };
export const RESOURCE_TYPES = ['food', 'wood', 'stone', 'gold'];
export const MAX_MILITARY_POWER = 16;
export const MAX_MILITARY_BID = 7;

export const UNIT_TYPES = {
  villager: { name: 'Aldeano', category: 'economic', force: 0, range: 0, move: 1, carry: 2 },
  fishingBoat: { name: 'Pesquero', category: 'economic', force: 0, range: 0, move: 1, carry: 0, water: true, tags: ['ship'] },
  transportShip: { name: 'Barco de Transporte', category: 'economic', force: 0, range: 0, move: 2, carry: 6, water: true, tags: ['ship'] },

  militia: { name: 'Milicia', category: 'military', force: 2, range: 0, move: 1, tags: ['infantry','foot'] },
  archer: { name: 'Arquero', category: 'military', force: 1, range: 1, move: 1, tags: ['ranged','foot'] },
  skirmisher: { name: 'Escaramuzador', category: 'military', force: 1, range: 1, move: 1, tags: ['ranged','foot'] },
  spearman: { name: 'Piquero', category: 'military', force: 1, range: 0, move: 1, tags: ['infantry','foot'] },
  rider: { name: 'Jinete', category: 'military', force: 2, range: 0, move: 2, tags: ['cavalry','mounted'] },
  knight: { name: 'Caballero', category: 'military', force: 3, range: 0, move: 2, tags: ['cavalry','mounted'] },
  longbow: { name: 'Arquero de Tiro Largo', category: 'military', force: 2, range: 2, move: 1, tags: ['ranged','foot'] },
  elephant: { name: 'Elefante de Guerra', category: 'military', force: 3, range: 0, move: 1, tags: ['elephant','mounted'] },

  galley: { name: 'Galera', category: 'military', force: 2, range: 0, move: 1, water: true, tags: ['ship'] },

  ram: { name: 'Ariete', category: 'military', force: 1, range: 0, move: 0, tags: ['siege'] },
  scorpion: { name: 'Escorpión', category: 'military', force: 1, range: 1, move: 0, tags: ['siege'] },
  trebuchet: { name: 'Trebuchet', category: 'military', force: 1, range: 3, move: 0, tags: ['siege'] },

  monk: { name: 'Monje', category: 'religious', force: 0, range: 1, move: 1, tags: ['religious'] },
  missionary: { name: 'Misionero', category: 'religious', force: 0, range: 1, move: 2, tags: ['religious'] }
};

export const BUILDING_TYPES = {
  mill: { name: 'Molino', category: 'economic' },
  camp: { name: 'Camp. de Recursos', category: 'economic' },
  port: { name: 'Puerto', category: 'economic' },
  market: { name: 'Mercado', category: 'economic' },
  farm: { name: 'Granja', category: 'economic', multiple: true },

  barracks: { name: 'Cuartel', category: 'military' },
  tower: { name: 'Torre', category: 'military' },
  castle: { name: 'Castillo', category: 'military' },
  monastery: { name: 'Monasterio', category: 'military' },
  siege: { name: 'Asedio', category: 'military' }
};

export const AGE_COSTS = {
  feudal: { food: 4, wood: 2, stone: 1, gold: 1 },
  castles: { food: 6, wood: 4, stone: 2, gold: 2 },
  imperial: { food: 8, wood: 6, stone: 4, gold: 5 }
};

export const SOURCE_TO_RESOURCE = {
  animals: 'food',
  berries: 'food',
  forest: 'wood',
  gold: 'gold',
  stone: 'stone'
};

export const EXHAUSTED_TO = {
  animals: { terrain: 'plain', source: null },
  berries: { terrain: 'plain', source: null },
  forest: { terrain: 'plain', source: null },
  gold: { terrain: 'water', source: null },
  stone: { terrain: 'water', source: null }
};
