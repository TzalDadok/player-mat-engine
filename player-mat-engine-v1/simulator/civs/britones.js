import { tech, entry } from './common.js';

export const britones = {
  id: 'britanicos',
  name: 'BRITONES',
  units: {
    villager: entry('dark', 'tc', { food: 1 }, { alternateTraining: [{ age: 'dark', building: 'mill', cost: { food: 2 } }] }),
    fishingBoat: entry('dark', 'port', { wood: 2 }),
    transportShip: entry('dark', 'port', { wood: 3 }),
    militia: entry('dark', 'barracks', { food: 1, gold: 1 }),
    archer: entry('dark', 'barracks', { food: 1, wood: 2, gold: 1 }),
    skirmisher: entry('feudal', 'barracks', { food: 2, wood: 2 }),
    rider: entry('castles', 'barracks', { food: 2, gold: 3 }),
    galley: entry('castles', 'port', { wood: 3, gold: 1 }),
    longbow: entry('castles', 'castle', { food: 2, wood: 2, gold: 2 }),
    missionary: entry('castles', 'monastery', { food: 2, gold: 2 }),
    ram: entry('imperial', 'siege', { wood: 3, gold: 2 }),
    trebuchet: entry('imperial', 'siege', { wood: 4, gold: 3 })
  },
  buildings: {
    mill: entry('dark', null, { wood: 3 }),
    camp: entry('dark', null, { wood: 2 }),
    port: entry('dark', null, { wood: 4, stone: 2 }),
    barracks: entry('dark', null, { wood: 1, stone: 3, gold: 1 }),
    tower: entry('dark', null, { stone: 3, wood: 2 }),
    farm: entry('dark', null, { wood: 2 }, { terrains: ['plain'], maxPerHex: 2 }),
    market: entry('castles', null, { wood: 3 }),
    castle: entry('castles', null, { stone: 5, gold: 3 }),
    monastery: entry('castles', null, { wood: 3, stone: 2 }),
    siege: entry('imperial', null, { wood: 4, stone: 2, gold: 2 })
  },
  technologies: [
    tech('man_at_arms','Hombre de Armas','dark','barracks',{food:2,gold:1},'La Milicia gana +1 Fuerza.',['unitForce:militia:+1']),
    tech('garrison','Guarnición','dark','tower',{food:2,wood:1},'Arquería puede guarecerse en Torre.',['garrison:ranged']),
    tech('wheelbarrow','Carretilla','dark','tc',{wood:1,gold:1},'Aldeanos transportan +1 recurso.',['carry:villager:+1']),
    tech('loom','Telar','dark','tc',{food:1,wood:1},'Aldeanos +1 Fuerza.',['unitForce:villager:+1']),
    tech('double_edge','Doble Filo','dark','camp',{food:1,gold:1,stone:1},'Bosque produce +1 Madera por Aldeano.',['production:forest:+1']),
    tech('pasturing','Pastoreo','feudal','mill',{food:1,wood:1},'Comida de Animales utilizable sin transporte.',['remoteSpend:animalsFood']),
    tech('loading_nets','Redes de Carga','feudal','port',{wood:4},'Pesqueros transportan 2 recursos.',['carry:fishingBoat:2']),
    tech('march_discipline','Marcha Disciplin.','feudal','barracks',{food:2,gold:1},'Arquería entrenada puede salir adyacente.',['spawnAdjacent:ranged']),
    tech('zone_control','Zona de Control','feudal','tower',{wood:2,stone:1},'Torre limita movimiento enemigo adyacente.',['towerZoneControl']),
    tech('development','Desarrollo','feudal','tc',{food:2,gold:2},'Recupera 50% del coste de Edad actual.',['refundAge:0.5']),
    tech('gold_extraction','Exp. Aurífera','feudal','camp',{food:3,wood:1,stone:2},'Oro produce +1 por Aldeano.',['production:gold:+1']),
    tech('animal_husbandry','Ganadería','castles','mill',{food:3,wood:2,gold:2},'Animales no se sobreexplotan.',['noExhaustion:animals']),
    tech('naval_dominance','Dominio Naval','castles','port',{food:3,gold:4},'Galera suspende producción enemiga.',['galleySuppressProduction']),
    tech('master_artisans','Maest. Artesanos','castles','camp',{food:3,gold:4},'1 Piedra puede sustituirse por 2 Maderas al construir.',['stoneSubstitution']),
    tech('hidden_ram','Espolón Oculto','imperial','port',{wood:2,gold:2},'Galera +1 contra barcos sin Alcance.',['bonus:galley:shipsNoRange:+1']),
    tech('royal_admin','Admin. Real','imperial','tc',{food:4,gold:3},'Construcciones producen +1.',['buildingProduction:+1']),
    tech('trade_wagon','Carreta Mercante','imperial','mill',{wood:3,gold:2},'Mueve hasta 6 recursos entre construcciones.',['tradeWagon:6']),
    tech('levies','Levas','imperial','barracks',{food:3,gold:3},'Hasta 2 unidades de rango por turno.',['trainCap:ranged:2']),
    tech('elite','Élite','imperial','tower',{food:3,gold:3},'Longbow +1 Fuerza.',['unitForce:longbow:+1']),
    tech('heresy','Herejía','imperial','tc',{gold:5},'Convertidos mueren.',['heresy'])
  ]
};
