import { AoEGame } from '../engine/game.js';
import {
  generateFFA36Map,
  autoPlaceFFAPlayerCUs,
  chooseFFAStartAnchor,
  placementCategoryFor
} from '../maps/ffa36.js';
import { BENCHMARK_SEEDS } from '../runner/benchmark-seeds.js';
import { hexDistance } from '../engine/hex.js';

function ok(v,m){ if(!v) throw new Error(m); }

function countBy(items,keyFn){
  const out={};
  for(const item of items){
    const k=keyFn(item);
    out[k]=(out[k]||0)+1;
  }
  return out;
}

{
  const map=generateFFA36Map({
    seed:'ffa36-structure',
    players:['P1','P2','P3','P4']
  });

  ok(map.terrainIds.length===36,'FFA debe tener exactamente 36 terrenos.');
  ok(map.hexes.filter(h=>h.special==='wonder').length===1,'Debe haber una sola Maravilla.');
  ok(map.hexes.filter(h=>h.category==='primary').length===18,'Deben colocarse 18 primarios.');
  ok(map.hexes.filter(h=>h.category==='secondary').length===18,'Deben colocarse 18 secundarios.');
  ok(map.perimeterIds.length===18,'La tercera grada debe tener 18 posiciones exteriores.');

  const rings=countBy(map.placementHistory,x=>x.ring);
  ok(rings[1]===6,'Primera grada: 6 terrenos.');
  ok(rings[2]===12,'Segunda grada: 12 terrenos.');
  ok(rings[3]===18,'Tercera grada: 18 terrenos.');
}

{
  const map=generateFFA36Map({
    seed:'ffa36-sequence',
    players:['P1','P2','P3','P4']
  });

  const firstEight=map.placementHistory.slice(0,8).map(x=>[x.playerId,x.category]);
  const expected=[
    ['P1','primary'],
    ['P2','secondary'],
    ['P3','primary'],
    ['P4','secondary'],
    ['P1','secondary'],
    ['P2','primary'],
    ['P3','secondary'],
    ['P4','primary']
  ];

  ok(
    JSON.stringify(firstEight)===JSON.stringify(expected),
    'La secuencia inicial debe ser J1 P, J2 S, J3 P, J4 S, J1 S, J2 P, J3 S, J4 P.'
  );

  ok(
    map.placementHistory[5].ring===1 &&
    map.placementHistory[6].ring===2,
    'La primera grada debe terminar tras J2 Primario y la segunda comenzar con J3 Secundario.'
  );

  for(let playerIndex=0;playerIndex<4;playerIndex++){
    for(let ownTurn=0;ownTurn<9;ownTurn++){
      const expectedCategory=
        playerIndex%2===0
          ? (ownTurn%2===0?'primary':'secondary')
          : (ownTurn%2===0?'secondary':'primary');

      ok(
        placementCategoryFor(playerIndex,ownTurn)===expectedCategory,
        'Cada jugador debe alternar su propio mazo en cada intervención.'
      );
    }
  }
}

{
  const map=generateFFA36Map({
    seed:'ffa36-player-counts',
    players:['P1','P2','P3','P4']
  });

  for(const playerId of ['P1','P2','P3','P4']){
    const rows=map.placementHistory.filter(x=>x.playerId===playerId);
    ok(rows.length===9,`${playerId} debe colocar 9 terrenos.`);

    const categories=countBy(rows,x=>x.category);

    if(['P1','P3'].includes(playerId)){
      ok(categories.primary===5&&categories.secondary===4,`${playerId} debe colocar 5 P y 4 S.`);
      ok(map.discarded[playerId].primary.length===5,`${playerId} debe descartar 5 primarios.`);
      ok(map.discarded[playerId].secondary.length===4,`${playerId} debe descartar 4 secundarios.`);
    }else{
      ok(categories.primary===4&&categories.secondary===5,`${playerId} debe colocar 4 P y 5 S.`);
      ok(map.discarded[playerId].primary.length===6,`${playerId} debe descartar 6 primarios.`);
      ok(map.discarded[playerId].secondary.length===3,`${playerId} debe descartar 3 secundarios.`);
    }

    const placedTypes=countBy(rows.filter(x=>x.category==='primary'),x=>x.type);
    const discardedPrimary=countBy(map.discarded[playerId].primary,x=>x.type);

    for(const type of ['forest','animals','berries','gold','stone']){
      ok(
        (placedTypes[type]||0)+(discardedPrimary[type]||0)===2,
        `${playerId} debe empezar con exactamente 2 ${type}.`
      );
    }

    const placedSecondary=countBy(rows.filter(x=>x.category==='secondary'),x=>x.type);
    const discardedSecondary=countBy(map.discarded[playerId].secondary,x=>x.type);

    for(const type of ['water','desert','plain','mountain']){
      ok(
        (placedSecondary[type]||0)+(discardedSecondary[type]||0)===2,
        `${playerId} debe empezar con exactamente 2 ${type}.`
      );
    }
  }
}

{
  const a=generateFFA36Map({seed:'ffa36-repeat',players:['P1','P2','P3','P4']});
  const b=generateFFA36Map({seed:'ffa36-repeat',players:['P1','P2','P3','P4']});

  ok(
    JSON.stringify(a.placementHistory)===JSON.stringify(b.placementHistory),
    'La misma seed debe reproducir robos y posiciones de las tres gradas.'
  );

  ok(
    JSON.stringify(a.discarded)===JSON.stringify(b.discarded),
    'La misma seed debe reproducir también los descartes.'
  );
}

{
  const map=generateFFA36Map({seed:'ffa36-cu',players:['P1','P2','P3','P4']});
  const expected=[];
  const chosen=[];

  for(const playerId of ['P1','P2','P3','P4']){
    const choice=chooseFFAStartAnchor(map,playerId,chosen);
    expected.push(choice.id);
    chosen.push(choice.id);
  }

  const placements=autoPlaceFFAPlayerCUs(map,['P1','P2','P3','P4']);
  const wonder=map.hexes.find(h=>h.special==='wonder');

  ok(
    placements.every((cu,i)=>cu.tcAnchorId===expected[i]),
    'Los CU deben elegirse secuencialmente después de generado el mapa.'
  );

  ok(
    placements.every(cu=>hexDistance(cu,wonder)===4),
    'Los CU deben quedar fuera de la tercera grada.'
  );

  ok(
    placements.every(cu=>!map.terrainIds.includes(cu.id)),
    'Los CU no forman parte de los 36 terrenos.'
  );

  for(let i=0;i<placements.length;i++){
    for(let j=i+1;j<placements.length;j++){
      ok(
        hexDistance(placements[i],placements[j])>=2,
        'Dos CU nunca pueden quedar pegados.'
      );
    }
  }
}

{
  const g=AoEGame.createFFA({
    seed:'ffa36-game',
    players:[
      {id:'P1',civ:'britanicos'},
      {id:'P2',civ:'francos'},
      {id:'P3',civ:'vikingos'},
      {id:'P4',civ:'persas'}
    ]
  });

  ok(g.state.mapMeta.preset==='ffa36','El juego debe registrar el preset FFA36.');
  ok(g.state.mapMeta.terrainIds.length===36,'El juego debe conservar 36 terrenos.');
  ok(g.state.mapMeta.placementHistory.length===36,'Debe conservar el historial completo de colocación.');
  ok(g.state.hexes.length===41,'36 terrenos + Maravilla + 4 CU = 41 hexágonos.');
  ok(g.state.hexes.filter(h=>h.special==='tc').length===4,'Debe haber 4 CU exteriores.');

  ok(
    g.state.players.every(p=>
      g.state.units.some(u=>
        u.ownerId===p.id&&
        u.type==='villager'&&
        u.hexId===p.tcHexId
      )
    ),
    'Cada jugador debe arrancar con un Aldeano en su CU.'
  );
}

{
  for(const seed of BENCHMARK_SEEDS){
    const map=generateFFA36Map({seed,players:['P1','P2','P3','P4']});
    const placements=autoPlaceFFAPlayerCUs(map,['P1','P2','P3','P4']);

    ok(map.terrainIds.length===36,`Seed ${seed}: el mapa debe tener 36 terrenos.`);

    for(let i=0;i<placements.length;i++){
      for(let j=i+1;j<placements.length;j++){
        ok(
          hexDistance(placements[i],placements[j])>=2,
          `Seed ${seed}: los CU no pueden ser adyacentes.`
        );
      }
    }
  }
}

console.log('FFA36 generation tests: OK');
