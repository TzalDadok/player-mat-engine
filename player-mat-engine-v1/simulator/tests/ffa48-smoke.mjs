import { AoEGame } from '../engine/game.js';
import { generateFFA48Map } from '../maps/ffa48.js';

function ok(v,m){ if(!v) throw new Error(m); }

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
    g.state.players.every(p=>g.state.units.some(u=>u.ownerId===p.id&&u.type==='villager'&&u.hexId===p.tcHexId)),
    'Cada jugador debe arrancar con un Aldeano en el CU.'
  );
  ok(g.state.hexes.length===53,'48 terrenos + Maravilla + 4 CU = 53 hexágonos.');
}

console.log('FFA 48 map tests: OK');
