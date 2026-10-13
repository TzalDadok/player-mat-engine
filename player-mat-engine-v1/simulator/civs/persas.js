import { tech, entry } from './common.js';

export const persas = {
  id: 'persas',
  name: 'PERSAS',
  units: {
    villager: entry('dark', 'tc', { food: 1 }),
    fishingBoat: entry('dark', 'port', { wood: 2 }),
    transportShip: entry('dark', 'port', { wood: 3 }),
    militia: entry('dark', 'barracks', { food: 1, gold: 1 }),
    archer: entry('dark', 'barracks', { food: 1, wood: 2, gold: 1 }),
    spearman: entry('feudal', 'barracks', { food: 2, wood: 1 }),
    galley: entry('castles', 'port', { wood: 3, gold: 1 }),
    elephant: entry('castles', 'barracks', { food: 4, gold: 4 })
  },
  buildings: {
    mill: entry('dark', null, { wood: 3 }),
    camp: entry('dark', null, { wood: 2 }),
    port: entry('dark', null, { wood: 4, stone: 2 }),
    barracks: entry('dark', null, { wood: 1, stone: 3, gold: 1 }),
    tower: entry('dark', null, { stone: 3, wood: 2 }),
    farm: entry('dark', null, { wood: 2 }, { terrains: ['plain'], maxPerHex: 2 }),
    market: entry('castles', null, { wood: 3 }),
    castle: entry('castles', null, { stone: 4, gold: 2 })
  },
  technologies: [
    tech('wheelbarrow','Carretilla','dark','camp',{wood:1,gold:1},'Aldeanos +1 carga.',['carry:villager:+1']),
    tech('border_guard','Guardia de Frontera','dark','tower',{wood:1,stone:1},'Torre +1 Fuerza en su hexágono.',['towerOwnHex:+1']),
    tech('loom','Telar','dark','tc',{food:1,wood:1},'Aldeanos +1 Fuerza.',['unitForce:villager:+1']),
    tech('royal_road','Camino Real','feudal','tc',{food:2,wood:2},'Aldeano entre construcciones propias mueve 2.',['roadMovement:villager:2']),
    tech('qanats','Qanats','feudal','mill',{wood:2,stone:2},'Granjas en Desierto; junto a Montaña +1 Comida.',['farmTerrain:desert','farmMountainBonus:+1']),
    tech('imperial_mining','Minería Imperial','feudal','camp',{food:3,wood:1,stone:2},'Oro +1 por Aldeano.',['production:gold:+1']),
    tech('loading_nets','Redes de Carga','feudal','port',{wood:4},'Pesqueros transportan 2.',['carry:fishingBoat:2']),
    tech('royal_fortification','Fortificación Real','feudal','tower',{wood:2,stone:2},'Torre defensora +1 apuesta máxima.',['towerDefenseMaxBid:+1']),
    tech('forage','Forraje','castles','mill',{food:3,wood:2,gold:1},'Elefante puede pagar hasta 2 Comidas desde Granjas.',['elephantFarmFood:2']),
    tech('royal_tribute','Tributo Real','castles','camp',{food:2,wood:2,gold:2},'1 Oro/Piedra producido puede ir al CU.',['tributeProduction:1']),
    tech('tributary_fleet','Flota Tributaria','castles','port',{wood:3,gold:2},'Primera Galera -1 Madera.',['firstTrainDiscount:galley:wood:1']),
    tech('mahouts','Mahouts','castles','barracks',{food:2,gold:3},'Elefante + unidad a pie: +1 Fuerza total.',['mahouts:+1']),
    tech('satrapies','Satrapías','imperial','tc',{food:4,gold:4},'Tras PRODUCIR mueve 2 recursos entre construcciones.',['postProductionTransfer:2']),
    tech('royal_breeders','Criad. Reales','imperial','mill',{food:3,wood:2,gold:2},'Elefante -1 Comida.',['unitCost:elephant:food:-1']),
    tech('lamellar_armor','Armadura Laminar','imperial','camp',{stone:3,gold:4},'Elefante +1 Fuerza.',['unitForce:elephant:+1']),
    tech('imperial_fleet','Flota Imperial','imperial','port',{food:2,wood:3,gold:2},'Transportes y Galeras +1 Movimiento.',['unitMove:transportShip:+1','unitMove:galley:+1']),
    tech('howdah','Howdah','imperial','barracks',{food:3,wood:2,gold:3},'Arquero junto a Elefante +1 Alcance.',['howdah:+1']),
    tech('wall_breaker','Rompemuros','imperial','barracks',{food:3,gold:4},'Bonus Elefante contra construcciones pasa a +2.',['bonus:elephant:building:2']),
    tech('imperial_loyalty','Lealtad Imperial','imperial','tower',{gold:5},'Elefantes convertidos mueren.',['heresyUnit:elephant'])
  ]
};
