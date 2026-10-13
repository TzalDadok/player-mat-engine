import { runBenchmark, summarizeGames, wilsonInterval } from '../runner/benchmark.mjs';
import { compareBenchmarks } from '../runner/compare-benchmarks.mjs';

function ok(v,m){ if(!v) throw new Error(m); }

{
  const ci=wilsonInterval(5,10);
  ok(ci && ci.low<0.5 && ci.high>0.5,'Wilson CI debe contener la proporción observada.');
  ok(wilsonInterval(0,0)===null,'Wilson CI sin muestra debe ser null.');
}

{
  const games=[
    {
      status:'completed',
      winnerId:'P1',
      rounds:10,
      players:[
        {id:'P1',civ:'a',start:{score:4},combat:{fought:1,wins:1},milestones:{}},
        {id:'P2',civ:'b',start:{score:3},combat:{fought:1,wins:0},milestones:{}}
      ]
    },
    {
      status:'max-rounds',
      winnerId:null,
      rounds:20,
      players:[
        {id:'P1',civ:'a',start:{score:5},combat:{fought:2,wins:0},milestones:{}},
        {id:'P2',civ:'b',start:{score:2},combat:{fought:2,wins:0},milestones:{}}
      ]
    }
  ];

  for(const g of games){
    for(const p of g.players){
      Object.assign(p,{
        militaryTrained:0,
        villagersTrained:0,
        technologies:0,
        eliminatedRound:null
      });
    }
  }

  const summary=summarizeGames(games,['a','b']);
  ok(summary.completed===1 && summary.incomplete===1,'Debe separar partidas completadas y no completadas.');
  ok(summary.civs.a.completedAppearances===1,'Sólo una aparición de a debe entrar al win rate.');
  ok(summary.civs.a.incompleteAppearances===1,'La partida incompleta debe quedar separada.');
  ok(summary.civs.a.winRate===1,'Una incompleta no puede contarse como derrota.');
  ok(summary.civs.b.winRate===0,'b debe tener 0% en la única partida completada.');
}

{
  const benchmark=runBenchmark({
    seeds:['hito3-smoke'],
    profiles:['balanced'],
    maxRounds:60
  });

  ok(benchmark.benchmarkVersion==='hito3-v1','Debe identificar la versión del benchmark.');
  ok(benchmark.mapPreset==='ffa36','Hito 3 debe usar el FFA36 físico.');
  ok(benchmark.games===4,'Una seed y cuatro rotaciones deben generar cuatro partidas.');
  ok(benchmark.seatSummary.length===4,'Debe resumir los cuatro asientos.');
  ok(
    benchmark.results.every(g=>g.players.every(p=>p.seat>=1&&p.seat<=4)),
    'Cada jugador debe registrar su asiento.'
  );
  ok(
    benchmark.results.every(g=>g.players.every(p=>p.start && 'score' in p.start)),
    'Cada jugador debe registrar la calidad estimada de su arranque.'
  );
  ok(
    benchmark.results.every(g=>g.players.every(p=>p.combat)),
    'Cada jugador debe registrar métricas de combate.'
  );
  ok(
    benchmark.results.every(g=>g.players.every(p=>
      p.economy &&
      Number.isFinite(p.economy.totalProduced) &&
      Number.isFinite(p.economy.totalSpent)
    )),
    'Cada jugador debe registrar flujo económico.'
  );
}

{
  const base={
    benchmarkVersion:'hito3-v1',
    mapPreset:'ffa36',
    revision:'base',
    games:2,
    completed:2,
    civOrderBase:['a','b'],
    results:[
      {
        profile:'balanced',seed:'s1',seatRotation:0,status:'completed',
        winnerId:'P1',winnerCiv:'a',
        players:[{id:'P1',civ:'a'},{id:'P2',civ:'b'}]
      },
      {
        profile:'balanced',seed:'s2',seatRotation:0,status:'completed',
        winnerId:'P2',winnerCiv:'b',
        players:[{id:'P1',civ:'a'},{id:'P2',civ:'b'}]
      }
    ]
  };

  const candidate=structuredClone(base);
  candidate.revision='candidate';
  candidate.results[1].winnerId='P1';
  candidate.results[1].winnerCiv='a';

  const cmp=compareBenchmarks(base,candidate);
  ok(cmp.matchedPairs===2 && cmp.bothCompleted===2,'A/B debe emparejar las mismas partidas.');
  ok(cmp.civs.a.gainedWins===1,'a debe registrar una victoria ganada por el cambio.');
  ok(cmp.civs.b.lostWins===1,'b debe registrar una victoria perdida por el cambio.');
}

console.log('Hito 3 balance methodology tests: OK');


{
  const regression=runBenchmark({
    seeds:['bench-006'],
    profiles:['aggressive'],
    maxRounds:40
  });

  ok(
    regression.results.every(g=>
      g.players.some(p=>p.economy?.totalProduced>0)
    ),
    'bench-006 no debe volver a quedar atrapado sin producir recursos.'
  );
}

console.log('Hito 3 bench-006 logistics regression: OK');


{
  const forward=runBenchmark({
    seeds:['hito3-cu-order'],
    profiles:['balanced'],
    maxRounds:40,
    cuSelectionOrder:['P1','P2','P3','P4']
  });
  const reverse=runBenchmark({
    seeds:['hito3-cu-order'],
    profiles:['balanced'],
    maxRounds:40,
    cuSelectionOrder:['P4','P3','P2','P1']
  });

  ok(
    forward.results.every(g=>
      JSON.stringify(g.cuSelectionOrder)===JSON.stringify(['P1','P2','P3','P4'])
    ),
    'Variante A debe conservar el orden normal de elección de CU.'
  );
  ok(
    reverse.results.every(g=>
      JSON.stringify(g.cuSelectionOrder)===JSON.stringify(['P4','P3','P2','P1'])
    ),
    'Variante B debe invertir sólo el orden de elección de CU.'
  );
}

console.log('Hito 3 CU-order experiment tests: OK');
