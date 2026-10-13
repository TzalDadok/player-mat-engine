import {mkdirSync,writeFileSync} from 'node:fs';
import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
import {summarizeGames,DEFAULT_PROFILES,wilsonInterval} from './benchmark.mjs';
import {BENCHMARK_SEEDS} from './benchmark-seeds.js';
import {balancedRandomCuOrders} from './run-cu-balanced-experiment.mjs';

const seats=['P1','P2','P3','P4'];
const rotate=(a,n)=>[...a.slice(n),...a.slice(0,n)];
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const buckets=()=>Array.from({length:4},(_,i)=>({index:i+1,appearances:0,wins:0,scores:[],winRate:null,ci95:null,meanScore:null}));
const variants={};
for(const villagers of [3]){
  const games=[],seatPriority=Array.from({length:4},buckets),perSeed=[];
  for(const seed of BENCHMARK_SEEDS){
    const seedGames=[];
    for(const profile of DEFAULT_PROFILES){
      for(let rotation=0;rotation<4;rotation++){
        const orders=balancedRandomCuOrders(`${profile}:${seed}:${rotation}`);
        for(const [orderRotation,cuSelectionOrder] of orders.entries()){
          const g=runFFAGame({civs:rotate(DEFAULT_CIVS,rotation),seed,
            botSeed:`benchmark:${profile}:${seed}`,profile,maxRounds:400,
            mapPreset:'ffa60',cuSelectionOrder,startingVillagers:villagers,requireTwoAdjacentLand:true});
          g.profile=profile;g.seatRotation=rotation;g.cuOrderRotation=orderRotation;
          if(g.status!=='completed') throw Error(`Incomplete game: ${seed}/${profile}/${rotation}/${orderRotation}/${villagers}: ${g.status}`);
          for(const p of g.players){
            const priority=p.start.selectionIndex-1,seat=p.seat-1;
            if(!Number.isInteger(priority)||priority<0||priority>3) throw Error('Invalid selection priority');
            const b=seatPriority[seat][priority];b.appearances++;
            b.wins+=+(g.winnerId===p.id);
            if(Number.isFinite(p.start.score))b.scores.push(p.start.score);
          }
          seedGames.push(g);games.push(g);
        }
      }
    }
    perSeed.push({seed,games:seedGames.length,
      priorityWins:seats.map((_,i)=>seedGames.filter(g=>g.players.some(p=>p.id===g.winnerId&&p.start.selectionIndex===i+1)).length),
      seatWins:seats.map((_,i)=>seedGames.filter(g=>g.winnerId===seats[i]).length)});
  }
  for(const row of seatPriority) for(const b of row){
    b.winRate=b.appearances?b.wins/b.appearances:null;
    b.ci95=wilsonInterval(b.wins,b.appearances);b.meanScore=mean(b.scores);delete b.scores;
    if(b.appearances!==640)throw Error(`Unbalanced seat priority ${b.index}: ${b.appearances}`);
  }
  const priority=buckets(),seat=buckets();
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    const x=seatPriority[i][j];
    for(const [row] of [[seat[i]],[priority[j]]]){row.appearances+=x.appearances;row.wins+=x.wins;}
  }
  for(const b of [...priority,...seat]){
    b.winRate=b.wins/b.appearances;b.ci95=wilsonInterval(b.wins,b.appearances);
    if(b.appearances!==2560)throw Error('Unbalanced aggregation');
  }
  variants[`villagers${villagers}`]={...summarizeGames(games,DEFAULT_CIVS),priority,seat,seatPriority,perSeed};
  console.log(`Completed ${games.length} games with ${villagers} villagers`);
}
const results={experiment:'FFA60 balanced CU priorities 40 seeds',mapPreset:'ffa60',seeds:BENCHMARK_SEEDS,
  profiles:DEFAULT_PROFILES,startingPositions:'Require two adjacent land hexes for both variants',
  notes:'40 seeds x 4 profiles x 4 civilization rotations x 4 CU order rotations per villager variant',
  variants};
const pct=n=>n==null?'—':(100*n).toFixed(1)+'%';
const v=variants.villagers3;
const lines=['# Hito 3 — FFA60: 40 semillas, 3 aldeanos y prioridad equilibrada','',
 '40 mapas x 4 perfiles x 4 rotaciones de civilizaciones x 4 rotaciones del orden de CU = 2560 partidas.',
 'Cada asiento tuvo cada prioridad 640 veces. Se exige dos terrenos terrestres adyacentes para todos los CU.',
 '',`Partidas terminadas: ${v.completed}/${v.games}.`,`Rondas promedio: ${v.avgRoundsCompleted?.toFixed(1)}.`,
 '', '## Victorias por prioridad de CU',
 '| Prioridad | Victorias | IC Wilson 95% | Calidad inicial |',
 '|---|---:|---:|---:|',
 ...v.priority.map((p,i)=>{
    const scores=v.seatPriority.map(row=>row[i].meanScore).filter(Number.isFinite);
    const score=scores.reduce((a,b)=>a+b,0)/scores.length;
    return `| ${i+1}.ª | ${pct(p.winRate)} | ${pct(p.ci95.low)}–${pct(p.ci95.high)} | ${score.toFixed(1)} |`;
 }),
 '', '## Victorias por asiento','| Asiento | Victorias | IC Wilson 95% |','|---|---:|---:|',
 ...v.seat.map((p,i)=>`| P${i+1} | ${pct(p.winRate)} | ${pct(p.ci95.low)}–${pct(p.ci95.high)} |`),
 '', '## Control de balance de prioridad por asiento','| Asiento | 1.º | 2.º | 3.º | 4.º |','|---|---:|---:|---:|---:|',
 ...seats.map((_,i)=>`| P${i+1} | ${v.seatPriority[i].map(b=>b.appearances).join(' | ')} |`),
 '', 'El JSON incluye victorias por semilla para estimar sensibilidad entre mapas. Los IC Wilson son descriptivos: las 2560 partidas reutilizan únicamente 40 mapas independientes.',
 ''];
mkdirSync('results',{recursive:true});
writeFileSync('results/hito3-ffa60-priority-40.md',lines.join('\\n').replaceAll('\\n','\n'));
writeFileSync('results/hito3-ffa60-priority-40.json',JSON.stringify(results,null,2)+'\n');
console.log(lines.join('\n'));
