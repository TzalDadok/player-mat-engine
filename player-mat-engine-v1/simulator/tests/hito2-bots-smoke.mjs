import { runFFAGame } from '../runner/simulate.js';
import { runBatch } from '../runner/batch.mjs';
import { runBenchmark } from '../runner/benchmark.mjs';
import { getBotProfile } from '../bots/profiles.js';
import { runDuelBenchmark } from '../runner/duel-benchmark.mjs';

function ok(v,m){ if(!v) throw new Error(m); }

{
  const r = runFFAGame({
    civs:['britanicos','francos'],
    seed:'hito2-duel',
    maxRounds:80,
    maxSteps:2000
  });

  ok(['completed','max-rounds','max-steps'].includes(r.status),'Estado de simulación inválido.');
  ok(r.players.length===2,'Debe conservar dos jugadores.');
  ok(r.actions>0,'Los bots deben realizar acciones.');
  ok(r.players.every(p=>p.bot.successfulActions>0),'Cada bot debe ejecutar acciones válidas.');
  ok(r.players.every(p=>p.milestones),'Cada jugador debe exponer hitos de balance.');
}

{
  const a = runFFAGame({
    civs:['britanicos','francos','vikingos','persas'],
    seed:'reproducible',
    botSeed:'same',
    maxRounds:40
  });
  const b = runFFAGame({
    civs:['britanicos','francos','vikingos','persas'],
    seed:'reproducible',
    botSeed:'same',
    maxRounds:40
  });

  ok(a.status===b.status,'Misma seed debe repetir estado final.');
  ok(a.rounds===b.rounds,'Misma seed debe repetir duración.');
  ok(a.winnerCiv===b.winnerCiv,'Misma seed debe repetir ganador.');
  ok(
    JSON.stringify(a.players.map(p=>[p.civ,p.age,p.technologies,p.militaryTrained,p.eliminated])) ===
    JSON.stringify(b.players.map(p=>[p.civ,p.age,p.technologies,p.militaryTrained,p.eliminated])),
    'Misma seed debe repetir métricas principales.'
  );
}

{
  const batch = runBatch({
    games:4,
    seedPrefix:'hito2-smoke',
    maxRounds:50
  });

  ok(batch.games.length===4,'Batch debe devolver todas las partidas.');
  ok(Object.keys(batch.civs).length===4,'Batch debe resumir las cuatro civilizaciones.');
  ok(batch.games.every(g=>g.actions>0),'Cada partida debe contener acciones.');
}

console.log('Hito 2 bot runner tests: OK');

{
  const aggressive=getBotProfile('aggressive');
  const technological=getBotProfile('technological');
  ok(aggressive.aggression > technological.aggression,'Los perfiles deben producir estilos realmente distintos.');

  const benchmark=runBenchmark({
    seeds:['hito2-benchmark'],
    profiles:['balanced','aggressive'],
    maxRounds:30
  });

  ok(benchmark.games===8,'1 mapa × 4 asientos × 2 perfiles debe producir 8 partidas.');
  ok(Object.keys(benchmark.byProfile).length===2,'Debe resumir cada perfil por separado.');
  ok(
    Object.values(benchmark.civs).every(c=>c.appearances===8),
    'Cada civilización debe aparecer la misma cantidad de veces.'
  );
}

console.log('Hito 2 benchmark/profile tests: OK');

{
  const duels=runDuelBenchmark({
    seeds:['hito2-duel-benchmark'],
    profiles:['balanced'],
    maxRounds:20
  });
  ok(duels.games===12,'4 civilizaciones deben producir 6 cruces × 2 asientos = 12 duelos.');
  ok(Object.keys(duels.matchups).length===6,'Debe haber seis matchups únicos entre cuatro civilizaciones.');
}

console.log('Hito 2 duel benchmark tests: OK');
