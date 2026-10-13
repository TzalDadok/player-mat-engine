import { mkdirSync, writeFileSync } from 'node:fs';
import { runBenchmark } from './benchmark.mjs';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';
const seeds=BENCHMARK_SEEDS.slice(0,10);
const orders={normal:['P1','P2','P3','P4'],reverse:['P4','P3','P2','P1']};
const results={experiment:'hito3-ffa60-audited-matched',seeds,notes:'Shared CU eligibility (2 adjacent land hexes), same seeds/profiles/rotation for 1 vs 3 villagers',variants:{}};
for(const [orderId,order] of Object.entries(orders)){
 for(const villagers of [1,3]){
  const key=orderId+'-'+villagers;
  const b=runBenchmark({seeds,cuSelectionOrder:order,mapPreset:'ffa60',startingVillagers:villagers,requireTwoAdjacentLand:true});
  results.variants[key]={games:b.games,completed:b.completed,completionRate:b.completionRate,avgRoundsCompleted:b.avgRoundsCompleted,seatSummary:b.seatSummary,civs:Object.fromEntries(Object.entries(b.civs).map(([k,v])=>[k,{winRate:v.winRate,avgCombats:v.avgCombats}]))};
  if(b.completed!==b.games) throw Error('Incompletas en '+key);
 }
}
const pct=n=>(100*n).toFixed(1)+'%';
const lines=['# Auditoría FFA60 — Experimento controlado (CU compatible con 3 aldeanos)','',
 'Las dos variantes tienen exactamente los mismos mapas y el mismo filtro de posiciones CU con 2 terrenos terrestres adyacentes.',
 'Esto evita comparar setups diferentes al modificar únicamente la cantidad de aldeanos.','',
 '| Orden CU | Aldeanos | Completadas | Rondas | J1 | J2 | J3 | J4 |',
 '|---|---:|---:|---:|---:|---:|---:|---:|'];
for(const [id,v] of Object.entries(results.variants)){
 const [order,count]=id.split('-');
 lines.push(`| ${order} | ${count} | ${v.completed}/${v.games} | ${v.avgRoundsCompleted.toFixed(1)} | ${v.seatSummary.map(s=>pct(s.winRate)).join(' | ')} |`);
}
lines.push('', 'Las prioridades reales corresponden J1→J4 en normal y J4→J1 en reverse. No se cambiaron habilidades ni costes de civilizaciones.');
mkdirSync('results',{recursive:true});
writeFileSync('results/hito3-ffa60-audited-matched.json',JSON.stringify(results,null,2)+'\n');
writeFileSync('results/hito3-ffa60-audited-matched.md',lines.join('\n')+'\n');
console.log(lines.join('\n'));
