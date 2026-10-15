// Temporary logistics regression
await import('./assert-connected-spending.mjs');
await import('./diagnose-logistics-70.mjs');
import { writeFileSync, mkdirSync } from 'node:fs';
import { runBenchmark } from './benchmark.mjs';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';
import { generateFFA36Map, generateFFA60Map, autoPlaceFFAPlayerCUs } from '../maps/ffa36.js';

const count=Math.max(1,Math.min(40,Number(process.argv[2]||10)));
const seeds=BENCHMARK_SEEDS.slice(0,count);
const players=['P1','P2','P3','P4'];
function verifyMap(preset,make){
  for(const seed of seeds){
    const map=make({seed,players});
    const expected=preset==='ffa60'?60:36;
    const radius=preset==='ffa60'?4:3;
    if(map.terrainIds.length!==expected || map.perimeterIds.length!==6*radius ||
       map.placementHistory.length!==expected) throw Error(`Invalid ${preset} setup for ${seed}`);
    const counts=Object.fromEntries(players.map(p=>[p,0]));
    for(const row of map.placementHistory) counts[row.playerId]++;
    for(const p of players) if(counts[p]!==expected/4) throw Error(`Invalid builder contribution ${p}`);
    const placements=autoPlaceFFAPlayerCUs(map,players);
    if(placements.length!==4) throw Error('Invalid CU placement');
  }
}
verifyMap('ffa36',generateFFA36Map);
verifyMap('ffa60',generateFFA60Map);
function priorityTable(bench){
 const rows=Array.from({length:4},(_,i)=>({priority:i+1,appearances:0,wins:0,winRate:null,avgStartScore:null,scores:[]}));
 for(const game of bench.results.filter(g=>g.status==='completed')){
  for(const p of game.players){
   const n=p.start?.selectionIndex;
   if(!Number.isInteger(n)||n<1||n>4) continue;
   const row=rows[n-1];row.appearances++;
   if(p.id===game.winnerId)row.wins++;
   if(Number.isFinite(p.start.score))row.scores.push(p.start.score);
  }
 }
 return rows.map(({scores,...r})=>({...r,winRate:r.appearances?r.wins/r.appearances:null,
 avgStartScore:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null}));
}
function compact(b){
 return {mapPreset:b.mapPreset,games:b.games,completed:b.completed,completionRate:b.completionRate,
 avgRoundsCompleted:b.avgRoundsCompleted,seatSummary:b.seatSummary,priorities:priorityTable(b),
 civs:Object.fromEntries(Object.entries(b.civs).map(([k,v])=>[k,{winRate:v.winRate}])),
 avgCombatsPerPlayer:Object.values(b.civs).reduce((s,v)=>s+(v.avgCombats||0),0)/4};
}
const a=runBenchmark({seeds,cuSelectionOrder:players,mapPreset:'ffa36'});
const d=runBenchmark({seeds,cuSelectionOrder:players,mapPreset:'ffa60'});
const results={experiment:'D',seeds,revision:process.env.GITHUB_SHA||null,reference:compact(a),expanded:compact(d)};
mkdirSync('results',{recursive:true});
writeFileSync('results/hito3-experiment-d-ffa60.json',JSON.stringify(results,null,2)+'\n');
const pct=n=>n==null?'—':(100*n).toFixed(1)+'%';
const num=n=>n==null?'—':n.toFixed(1);
const lines=['# Hito 3 — Experimento D: FFA36 vs FFA60','',
 `Seeds: ${count}. Igual orden de CU, perfiles y rotaciones; 4 perfiles × 4 rotaciones × ${count} seeds por variante.`,
 '', '| Métrica | 36 | 60 |','|---|---:|---:|',
 `| Partidas completas | ${a.completed}/${a.games} | ${d.completed}/${d.games} |`,
 `| Rondas medias (terminadas) | ${num(a.avgRoundsCompleted)} | ${num(d.avgRoundsCompleted)} |`,
 `| Combates medios por jugador | ${num(results.reference.avgCombatsPerPlayer)} | ${num(results.expanded.avgCombatsPerPlayer)} |`,
 '', '## Asientos','', '| Asiento | Victorias 36 | Victorias 60 | Calidad 36 | Calidad 60 |',
 '|---|---:|---:|---:|---:|',
 ...a.seatSummary.map((r,i)=>`| P${i+1} | ${pct(r.winRate)} | ${pct(d.seatSummary[i].winRate)} | ${num(r.avgStartScore)} | ${num(d.seatSummary[i].avgStartScore)} |`),
 '', '## Prioridad de elección del CU','',
 '| Prioridad | Victorias 36 | Victorias 60 | Calidad 36 | Calidad 60 |',
 '|---|---:|---:|---:|---:|',
 ...results.reference.priorities.map((r,i)=>`| ${i+1} | ${pct(r.winRate)} | ${pct(results.expanded.priorities[i].winRate)} | ${num(r.avgStartScore)} | ${num(results.expanded.priorities[i].avgStartScore)} |`),
 '', '## Civilizaciones','',
 '| Civilización | 36 | 60 |','|---|---:|---:|',
 ...Object.keys(a.civs).map(k=>`| ${k} | ${pct(a.civs[k].winRate)} | ${pct(d.civs[k].winRate)} |`),
 '', 'Los datos se basan en partidas completadas; revisar tasa de finalización antes de interpretar tasas de victoria.',
 'Las posiciones se seleccionan automáticamente mediante la misma heurística en ambos mapas.',
 ''];
writeFileSync('results/hito3-experiment-d-ffa60.md',lines.join('\n'));
console.log(lines.join('\n'));
