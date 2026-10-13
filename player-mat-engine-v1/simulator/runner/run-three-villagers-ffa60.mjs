import { writeFileSync, mkdirSync } from 'node:fs';
import { runBenchmark } from './benchmark.mjs';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';

const count=Math.max(1,Math.min(40,Number(process.argv[2]||10)));
const seeds=BENCHMARK_SEEDS.slice(0,count);
const configs=[
  {id:'normal',order:['P1','P2','P3','P4']},
  {id:'reverse',order:['P4','P3','P2','P1']}
];
const results={experiment:'FFA60-three-villagers',seeds,configurations:{}};
const fmt=n=>n==null?'—':n.toFixed(1);
const pct=n=>n==null?'—':(n*100).toFixed(1)+'%';
const lines=['# FFA60 — Tres aldeanos iniciales por jugador','',
  'Cada jugador empieza con uno en el CU y dos en hexágonos terrestres distintos adyacentes al CU. Mismos seeds, bots y rotaciones.','',
  '| Elección de CU | Partidas completas | Rondas promedio | J1 | J2 | J3 | J4 |',
  '|---|---:|---:|---:|---:|---:|---:|'];
for(const config of configs){
  const bench=runBenchmark({seeds,mapPreset:'ffa60',cuSelectionOrder:config.order,startingVillagers:3});
  const summary={games:bench.games,completed:bench.completed,completionRate:bench.completionRate,avgRoundsCompleted:bench.avgRoundsCompleted,seatSummary:bench.seatSummary,civs:bench.civs,
   avgCombatsPerPlayer:Object.values(bench.civs).reduce((s,c)=>s+(c.avgCombats||0),0)/4};
  results.configurations[config.id]=summary;
  lines.push(`| ${config.order.join(' → ')} | ${bench.completed}/${bench.games} | ${fmt(bench.avgRoundsCompleted)} | ${bench.seatSummary.map(s=>pct(s.winRate)).join(' | ')} |`);
}
lines.push('','## Calidad de posiciones iniciales','',
'| Configuración | J1 | J2 | J3 | J4 |','|---|---:|---:|---:|---:|');
for(const config of configs) lines.push(`| ${config.id} | ${results.configurations[config.id].seatSummary.map(s=>fmt(s.avgStartScore)).join(' | ')} |`);
lines.push('','## Observación','',
'La heurística que elige el CU y su calidad no se modifican; se cambia solamente la cantidad inicial de aldeanos.');
mkdirSync('results',{recursive:true});
writeFileSync('results/hito3-three-villagers-ffa60.json',JSON.stringify(results,null,2)+'\n');
writeFileSync('results/hito3-three-villagers-ffa60.md',lines.join('\n')+'\n');
console.log(lines.join('\n'));
