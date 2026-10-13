import { tech, entry } from './common.js';

export const vikingos = {
  id: 'vikingos',
  name: 'VIKINGOS',
  units: {
    villager: entry('dark', 'tc', { food: 1 }, { alternateTraining: [
      { age: 'feudal', building: 'mill', cost: { food: 2 } },
      { age: 'castles', building: 'camp', cost: { food: 2 } }
    ] }),
    fishingBoat: entry('dark', 'port', { wood: 2 }),
    galley: entry('dark', 'port', { wood: 3, gold: 1 }),
    militia: entry('dark', 'barracks', { food: 1, gold: 1 }),
    archer: entry('castles', 'barracks', { food: 1, wood: 2, gold: 1 }),
    scorpion: entry('castles', 'siege', { wood: 3, gold: 2 }),
    trebuchet: entry('castles', 'siege', { wood: 4, gold: 3 })
  },
  buildings: {
    mill: entry('dark', null, { wood: 3 }),
    camp: entry('dark', null, { wood: 2 }),
    port: entry('dark', null, { wood: 4, stone: 2 }),
    barracks: entry('dark', null, { wood: 1, stone: 3, gold: 1 }),
    market: entry('dark', null, { wood: 3 }),
    farm: entry('castles', null, { wood: 2 }, { terrains: ['plain'], maxPerHex: 2 }),
    castle: entry('castles', null, { stone: 4, gold: 2 }),
    siege: entry('castles', null, { wood: 4, stone: 2, gold: 2 })
  },
  technologies: [
    tech('loom','Telar','dark','tc',{food:1,wood:1},'Aldeanos +1 Fuerza.',['unitForce:villager:+1']),
    tech('viking_settlement','Asent. Vikingo','dark','mill',{food:1,wood:2},'Captura Granjas indefensas.',['captureFarms']),
    tech('double_edge','Doble Filo','dark','camp',{food:1,gold:1,stone:1},'Bosque +1 Madera por Aldeano.',['production:forest:+1']),
    tech('urca','Urca','dark','port',{wood:2,gold:1},'Pesqueros transportan recursos ilimitados.',['carry:fishingBoat:infinite']),
    tech('raids','Saqueos','feudal','tc',{food:2,gold:1},'Roba 1 de producción enemiga >1 si Aldeano vikingo adyacente.',['productionRaid:1']),
    tech('wheelbarrow','Carretilla','feudal','camp',{wood:1,gold:1},'Aldeanos +1 carga.',['carry:villager:+1']),
    tech('master_artisans','Maest. Artesanos','feudal','camp',{food:3,gold:4},'1 Piedra por 2 Maderas al construir.',['stoneSubstitution']),
    tech('advanced_fishing','Pesca Avanzada','feudal','port',{food:2,wood:2},'Pesqueros +1 Comida.',['fishingBoatProduction:+1']),
    tech('drakkar','Drakkar','feudal','port',{wood:2,gold:2},'Galera transporta 6 unidades.',['galleyTransport:6']),
    tech('viking_warrior','Guerrero Vikingo','feudal','barracks',{food:2,gold:1},'2+ Milicias: +1 Fuerza total.',['militiaGroupForce:2:+1']),
    tech('dismantle','Desmantelar','feudal','other',{wood:3,gold:3},'Retira edificio y recupera 2 recursos.',['dismantle:2']),
    tech('trade_wagon','Carreta Mercante','castles','tc',{wood:3,gold:2},'Mueve 6 recursos entre construcciones.',['tradeWagon:6']),
    tech('optimized_naval_combat','Comb. Naval Opt.','castles','port',{wood:3,gold:3},'Barcos recorren Agua y desembarcan en una acción.',['navalNetworkMovement']),
    tech('war_axe','Hacha de Guerra','castles','barracks',{food:2,gold:2},'Milicia +1 atacando edificio.',['bonus:militia:attackingBuilding:+1']),
    tech('northern_colonists','Colonos del Norte','imperial','mill',{wood:3,gold:3},'Mueve Granja y Aldeano.',['moveFarm']),
    tech('naval_logistics','Logística Naval','imperial','camp',{wood:3,gold:3},'Producción adyacente a Agua puede cargarse a barco.',['navalLogistics']),
    tech('improved_drakkar','Drakkar Mejorado','imperial','port',{wood:4,gold:3},'Desembarcados pueden actuar Militar.',['disembarkMilitaryAction']),
    tech('warlords','Jefes Guerreros','imperial','barracks',{food:3,gold:3},'Al ganar recupera 1 Poder apostado.',['recoverBidOnWin:1']),
    tech('berserkergang','Berserkergang','imperial','barracks',{food:4,gold:3},'Atacando con 3+ Milicias +1 apuesta máxima.',['maxBidWhenAttacking:militia:3:+1']),
    tech('jarl_saloon','Jarl Saloon','imperial','other',{wood:3,stone:2,gold:3},'Castillo puede entrenar 2 Milicias pagando ambas.',['castleDoubleTrain:militia']),
    tech('royal_admin','Admin. Real','imperial','tc',{food:4,gold:3},'Construcciones producen +1.',['buildingProduction:+1'])
  ]
};
