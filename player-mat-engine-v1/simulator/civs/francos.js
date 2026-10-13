import { tech, entry } from './common.js';

export const francos = {
  id: 'francos',
  name: 'FRANCOS',
  units: {
    villager: entry('dark', 'tc', { food: 1 }),
    fishingBoat: entry('dark', 'port', { wood: 2 }),
    transportShip: entry('dark', 'port', { wood: 3 }),
    militia: entry('dark', 'barracks', { food: 1, gold: 1 }),
    archer: entry('dark', 'barracks', { food: 1, wood: 2, gold: 1 }),
    spearman: entry('feudal', 'barracks', { food: 2, wood: 1 }),
    rider: entry('castles', 'barracks', { food: 2, gold: 3 }),
    knight: entry('castles', 'barracks', { food: 3, gold: 4 }),
    galley: entry('castles', 'port', { wood: 3, gold: 1 }),
    monk: entry('castles', 'monastery', { food: 2, gold: 2 }, { provisionalCost: true }),
    scorpion: entry('castles', 'siege', { wood: 3, gold: 2 }, { provisionalCost: true }),
    trebuchet: entry('castles', 'siege', { wood: 4, gold: 3 }, { provisionalCost: true })
  },
  buildings: {
    mill: entry('dark', null, { wood: 3 }),
    camp: entry('dark', null, { wood: 2 }),
    port: entry('dark', null, { wood: 4, stone: 2 }),
    barracks: entry('dark', null, { wood: 1, stone: 3, gold: 1 }),
    tower: entry('dark', null, { stone: 3, wood: 2 }),
    farm: entry('dark', null, { wood: 2 }, { terrains: ['plain'], maxPerHex: 2 }),
    market: entry('castles', null, { wood: 3 }),
    castle: entry('castles', null, { stone: 4, gold: 2 }),
    monastery: entry('castles', null, { wood: 3, stone: 2 }),
    siege: entry('castles', null, { wood: 4, stone: 2, gold: 2 })
  },
  technologies: [
    tech('man_at_arms','Hombre de Armas','dark','barracks',{food:2,gold:1},'Milicia +1 Fuerza.',['unitForce:militia:+1']),
    tech('watch','Vigía','dark','tower',{wood:1,stone:1},'Torre +1 Fuerza en su hexágono.',['towerOwnHex:+1']),
    tech('wheelbarrow','Carretilla','dark','tc',{wood:1,gold:1},'Aldeanos transportan +1.',['carry:villager:+1']),
    tech('double_edge','Doble Filo','dark','camp',{food:1,gold:1,stone:1},'Bosque +1 Madera por Aldeano.',['production:forest:+1']),
    tech('colonization','Colonización','feudal','tc',{food:2,wood:2},'Aldeano entrenado puede salir adyacente.',['spawnAdjacent:villager']),
    tech('conscription','Conscripción','feudal','tc',{food:2,gold:1},'Primera Milicia del turno -1 Comida.',['firstTrainDiscount:militia:food:1']),
    tech('rotation','Rotación','feudal','mill',{food:2,wood:1},'Granjas no sufren sobreexplotación.',['noExhaustion:farm']),
    tech('open_fields','Campos Abiertos','feudal','mill',{food:3,wood:2},'Granjas también en Desierto.',['farmTerrain:desert']),
    tech('loading_nets','Redes de Carga','feudal','port',{wood:4},'Pesqueros transportan 2.',['carry:fishingBoat:2']),
    tech('hoplomachus','Hoplomachus','feudal','barracks',{food:2,gold:1},'Piquero gana bonus contra Milicia.',['bonus:spearman:militia:+1']),
    tech('wall','Muralla','feudal','tower',{wood:2,stone:2},'Fortificar puede pagarse con Piedra.',['fortifyAlternative:stone:2']),
    tech('stonemasons','Canteros','feudal','camp',{food:2,wood:1},'Piedra +1 por Aldeano.',['production:stone:+1']),
    tech('shipyard','Astillero','castles','port',{wood:3,gold:2},'Barcos pueden salir a Agua adyacente.',['spawnAdjacent:ships']),
    tech('charge','Carga','castles','barracks',{food:2,gold:2},'Montados +1 al atacar entrando.',['charge:+1']),
    tech('lordship','Señorío','castles','tower',{food:2,gold:2},'Jinete/Caballero entrenables en Castillo.',['alternateTraining:cavalry:castle']),
    tech('landing','Desembarco','imperial','port',{wood:3,food:2},'Transportados mueven 1 al desembarcar.',['landingMove:+1']),
    tech('blacksmith','Herrería','imperial','camp',{food:2,stone:2,gold:2},'Primera unidad militar -1 Oro.',['firstMilitaryGoldDiscount:1']),
    tech('heavy_cavalry','Caballería Pesada','imperial','barracks',{food:4,gold:4},'Caballero +1 Fuerza.',['unitForce:knight:+1']),
    tech('surplus','Excedentes','imperial','mill',{food:3,gold:2},'1 Comida por 1 Oro sin acción.',['exchange:food:gold:1']),
    tech('engineering','Ingeniería','imperial','camp',{wood:3,gold:3},'Escorpión puede salir adyacente.',['spawnAdjacent:scorpion']),
    tech('mobilization','Movilización','imperial','barracks',{food:3,gold:3},'Caballería puede aparecer en construcción militar propia.',['spawnMilitaryBuilding:cavalry']),
    tech('plunder','Saqueo','imperial','tower',{food:2,gold:3},'Tras ganar mueve 2 recursos con ejército.',['plunder:2']),
    tech('vassalage','Vasallaje','imperial','tower',{food:3,gold:3},'Caballería adyacente usa Castillo para entrenar.',['castleTrainingAdjacent:cavalry']),
    tech('heresy','Herejía','imperial','tc',{gold:5},'Convertidos mueren.',['heresy'])
  ]
};
