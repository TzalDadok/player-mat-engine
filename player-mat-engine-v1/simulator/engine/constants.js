export const PHASES = ['economy', 'technology', 'military'];
export const AGES = ['dark', 'feudal', 'castles', 'imperial'];
export const AGE_PRODUCTION_LIMIT = { dark: 2, feudal: 3, castles: 4, imperial: 5 };
export const RESOURCE_TYPES = ['food', 'wood', 'stone', 'gold'];
export const MAX_MILITARY_POWER = 16;
export const MAX_MILITARY_BID = 7;

export const UNIT_TYPES = {
  villager: { name: 'Aldeano', category: 'economic', force: 0, range: 0, move: 1, carry: 2, age: 'dark', cost: { food: 1 } },
  fishingBoat: { name: 'Pesquero', category: 'economic', force: 0, range: 0, move: 1, carry: 0, age: 'dark', cost: { wood: 2 }, building: 'port', water: true },
  transportShip: { name: 'Barco de Transporte', category: 'economic', force: 0, range: 0, move: 2, carry: 6, age: 'dark', cost: { wood: 3 }, building: 'port', water: true },
  militia: { name: 'Milicia', category: 'military', force: 2, range: 0, move: 1, age: 'dark', cost: { food: 1, gold: 1 }, building: 'barracks' },
  archer: { name: 'Arquero', category: 'military', force: 1, range: 1, move: 1, age: 'dark', cost: { food: 1, wood: 2, gold: 1 }, building: 'barracks' },
  skirmisher: { name: 'Escaramuzador', category: 'military', force: 1, range: 1, move: 1, age: 'feudal', cost: { food: 2, wood: 2 }, building: 'barracks' },
  spearman: { name: 'Piquero', category: 'military', force: 1, range: 0, move: 1, age: 'feudal', cost: { food: 2, wood: 1 }, building: 'barracks' },
  rider: { name: 'Jinete', category: 'military', force: 2, range: 0, move: 2, age: 'castles', cost: { food: 2, gold: 3 }, building: 'barracks' },
  galley: { name: 'Galera', category: 'military', force: 2, range: 0, move: 1, age: 'castles', cost: { wood: 3, gold: 1 }, building: 'port', water: true }
};

export const BUILDING_TYPES = {
  mill: { name: 'Molino', category: 'economic', cost: { wood: 3 } },
  camp: { name: 'Camp. de Recursos', category: 'economic', cost: { wood: 2 } },
  port: { name: 'Puerto', category: 'economic', cost: { wood: 4, stone: 2 } },
  barracks: { name: 'Cuartel', category: 'military', cost: { wood: 1, stone: 3, gold: 1 } },
  tower: { name: 'Torre', category: 'military', cost: { stone: 3, wood: 2 } },
  farm: { name: 'Granja', category: 'economic', cost: { wood: 2 }, multiple: true }
};

export const AGE_COSTS = {
  feudal: { food: 4, wood: 2, stone: 1, gold: 1 },
  castles: { food: 6, wood: 4, stone: 2, gold: 2 },
  imperial: { food: 8, wood: 6, stone: 4, gold: 5 }
};

export const SOURCE_TO_RESOURCE = {
  animals: 'food', berries: 'food', forest: 'wood', gold: 'gold', stone: 'stone'
};

export const EXHAUSTED_TO = {
  animals: { terrain: 'plain', source: null },
  berries: { terrain: 'plain', source: null },
  forest: { terrain: 'plain', source: null },
  gold: { terrain: 'water', source: null },
  stone: { terrain: 'water', source: null }
};
