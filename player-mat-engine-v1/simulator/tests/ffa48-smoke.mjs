import { AoEGame } from '../engine/game.js';
import {
  generateFFA48Map,
  autoPlaceFFAPlayerCUs,
  chooseFFAStartAnchor,
  scoreFFAStartAnchor
} from '../maps/ffa48.js';
import { BENCHMARK_SEEDS } from '../runner/benchmark-seeds.js';
import { hexDistance } from '../engine/hex.js';

function ok(v,m){ if(!v) throw new Error(m); }
function landReachable(hexes, fromId, toId){
  const byId=new Map(hexes.map(h=>[h.id,h]));
  const queue=[fromId];
  const seen=new Set(queue);

  while(queue.length){
    const id=queue.shift();
    if(id===toId)return true;
    const current=byId.get(id);
    for(const h of hexes){
      if(
        h.terrain==='water' ||
        seen.has(h.id) ||
        hexDistance(current,h)!==1
      )continue;
      seen.add(h.id);
      queue.push(h.id);
    }
  }
  return false;
}

{
  const map=generateFFA48Map({seed:'test-123'});
  ok(map.terrainIds.length===48,'FFA debe tener 48 terrenos.');
  ok(map.hexes.filter(h=>h.category==='primary').length===32,'FFA debe tener 32 primarios.');
  ok(map.hexes.filter(h=>h.category==='secondary').length===16,'FFA debe tener 16 secundarios.');
  ok(map.hexes.filter(h=>h.special==='wonder').length===1,'FFA debe tener una Maravilla.');
  ok(map.perimeterIds.length===12,'El perímetro compacto debe tener 12 posiciones exteriores de terreno.');

  const same=generateFFA48Map({seed:'test-123'});
  ok(
    JSON.stringify(map.hexes.map(h=>[h.id,h.terrain,h.source]))===
    JSON.stringify(same.hexes.map(h=>[h.id,h.terrain,h.source])),
    'La misma seed debe reproducir exactamente el mapa.'
  );
}

{
  const g=AoEGame.createFFA({
    seed:'players-4',
    players:[
      {id:'P1',civ:'britanicos'},
      {id:'P2',civ:'francos'},
      {id:'P3',civ:'vikingos'},
      {id:'P4',civ:'persas'}
    ]
  });

  ok(g.state.mapMeta.preset==='ffa48','Debe marcar el preset FFA48.');
  ok(g.state.mapMeta.terrainIds.length===48,'Game debe conservar los 48 terrenos.');
  ok(g.state.hexes.filter(h=>h.special==='tc').length===4,'Debe haber 4 CU adicionales.');
  ok(g.state.players.every(p=>p.tcHexId),'Cada jugador debe tener CU.');
  ok(
    g.state.players.every(p => {
      const tc = g.hexMap.get(p.tcHexId);
      const anchor = g.hexMap.get(tc.tcAnchorId);
      return anchor && anchor.terrain !== 'water';
    }),
    'Cada CU del FFA debe tener acceso terrestre inicial.'
  );

  const wonder=g.state.hexes.find(h=>h.special==='wonder');
  ok(
    g.state.players.every(p => {
      const tc=g.hexMap.get(p.tcHexId);
      const anchor=g.hexMap.get(tc.tcAnchorId);
      return landReachable(g.state.hexes,anchor.id,wonder.id);
    }),
    'Cada posición inicial debe pertenecer a la red terrestre conectada a la Maravilla.'
  );
  ok(
    g.state.players.every(p=>g.state.units.some(u=>u.ownerId===p.id&&u.type==='villager'&&u.hexId===p.tcHexId)),
    'Cada jugador debe arrancar con un Aldeano en el CU.'
  );
  ok(g.state.hexes.length===53,'48 terrenos + Maravilla + 4 CU = 53 hexágonos.');
}

console.log('FFA 48 map tests: OK');






{
  const map=generateFFA48Map({seed:'strategic-start'});
  const players=['P1','P2','P3','P4'];
  const expected=[];
  const chosen=[];

  for(const id of players){
    const choice=chooseFFAStartAnchor(map,id,chosen);
    expected.push(choice);
    chosen.push(choice.id);
  }

  const placements=autoPlaceFFAPlayerCUs(map,players);

  ok(
    placements.every((cu,i)=>cu.tcAnchorId===expected[i].id),
    'La colocación automática debe respetar la mejor elección exterior disponible de cada jugador.'
  );

  const wonder=map.hexes.find(h=>h.special==='wonder');
  ok(
    placements.every(cu=>hexDistance(cu,wonder)===5),
    'Cada CU debe quedar fuera del mapa, a distancia 5 del centro.'
  );

  ok(
    placements.every(cu=>!map.terrainIds.includes(cu.id)),
    'Los CU no forman parte de los 48 terrenos del mapa.'
  );

  ok(
    placements.every(cu=>{
      const adjacentTerrain=map.hexes.filter(
        h=>map.terrainIds.includes(h.id)&&hexDistance(cu,h)===1
      );
      return adjacentTerrain.length>=1 && adjacentTerrain.length<6;
    }),
    'Un CU exterior debe tocar el borde del mapa, nunca quedar rodeado por terrenos.'
  );

  ok(
    expected.every(x=>Number.isFinite(scoreFFAStartAnchor(map,x.id,[]))),
    'Las posiciones elegidas deben tener una valoración estratégica válida.'
  );
}

console.log('FFA strategic exterior start tests: OK');
