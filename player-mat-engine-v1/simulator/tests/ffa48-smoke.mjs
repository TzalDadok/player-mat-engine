import { AoEGame } from '../engine/game.js';
import { generateFFA48Map, autoPlaceFFAPlayerCUs } from '../maps/ffa48.js';
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

  ok(
    g.state.players.every(p => {
      const tc = g.hexMap.get(p.tcHexId);
      const anchor = g.hexMap.get(tc.tcAnchorId);
      return anchor && !['gold','stone'].includes(anchor.source);
    }),
    'La colocación automática debe evitar anclas de Oro/Piedra cuando existen alternativas estables.'
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
  for (const seed of BENCHMARK_SEEDS) {
    const map=generateFFA48Map({seed});
    autoPlaceFFAPlayerCUs(map,['P1','P2','P3','P4']);

    for (const cu of map.hexes.filter(h=>h.special==='tc')) {
      const anchor=map.hexes.find(h=>h.id===cu.tcAnchorId);
      ok(anchor,'Cada CU automático debe conservar su ancla.');
      ok(
        !['gold','stone'].includes(anchor.source),
        `Seed ${seed}: el CU ${cu.id} no debe elegir ${anchor.source} como ancla cuando hay alternativas estables.`
      );
    }
  }
}

console.log('FFA benchmark start selection tests: OK');

{
  for (const seed of BENCHMARK_SEEDS.slice(0,5)) {
    const map=generateFFA48Map({seed});
    autoPlaceFFAPlayerCUs(map,['P1','P2','P3','P4']);

    const byId=new Map(map.hexes.map(h=>[h.id,h]));
    const wonder=map.hexes.find(h=>h.special==='wonder');

    const permanentReachable = startId => {
      const queue=[startId];
      const seen=new Set(queue);

      while(queue.length){
        const id=queue.shift();
        if(id===wonder.id) return true;
        const current=byId.get(id);

        for(const h of map.hexes){
          if(
            h.terrain==='water' ||
            ['gold','stone'].includes(h.source) ||
            seen.has(h.id) ||
            hexDistance(current,h)!==1
          ) continue;
          seen.add(h.id);
          queue.push(h.id);
        }
      }
      return false;
    };

    ok(
      map.hexes
        .filter(h=>h.special==='tc')
        .every(cu=>permanentReachable(cu.tcAnchorId)),
      `Seed ${seed}: los CUs automáticos del benchmark de cierre deben conservar una ruta terrestre permanente al centro.`
    );
  }
}

console.log('FFA permanent-corridor start tests: OK');
