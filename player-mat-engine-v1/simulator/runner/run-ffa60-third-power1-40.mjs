import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
import {summarizeGames,DEFAULT_PROFILES,wilsonInterval} from './benchmark.mjs';
import {BENCHMARK_SEEDS} from './benchmark-seeds.js';
import {balancedRandomCuOrders} from './run-cu-balanced-experiment.mjs';

const seats=['P1','P2','P3','P4'];
const rotate=(a,n)=>[...a.slice(n),...a.slice(0,n)];
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const buckets=()=>Array.from({length:4},(_,i)=>({index:i+1,appearances:0,wins:0,scores:[],winRate:null,ci95:null,meanScore:null}));
const count=Math.max(1,Math.min(40,Number(process.argv[2]||40)));
const seeds=BENCHMARK_SEEDS.slice(0,count);
const setup=[{villagers:1,militaryPower:0},{villagers:2,militaryPower:0},{villagers:3,militaryPower:1},{villagers:3,militaryPower:0}];
const variants={};
for(const villagers of ['staggered']){
  const games=[],seatPriority=Array.from({length:4},buckets),perSeed=[];
  for(const seed of seeds){
    const seedGames=[];
    for(const profile of DEFAULT_PROFILES){
      for(let rotation=0;rotation<4;rotation++){
        const orders=balancedRandomCuOrders(`${profile}:${seed}:${rotation}`);
        for(const [orderRotation,cuSelectionOrder] of orders.entries()){
          const g=runFFAGame({civs:rotate(DEFAULT_CIVS,rotation),seed,
            botSeed:`benchmark:${profile}:${seed}`,profile,maxRounds:400,
            mapPreset:'ffa60',cuSelectionOrder,startingVillagers:1,startingSetupByPriority:setup,requireTwoAdjacentLand:true});
          g.profile=profile;g.seatRotation=rotation;g.cuOrderRotation=orderRotation;
          for(const p of g.players) {
            const expected=setup[p.start.selectionIndex-1];
            if(!expected || p.start.initialVillagers!==expected.villagers || p.start.initialMilitaryPower!==expected.militaryPower)
              throw Error('Inicio incorrecto para '+p.id+' prioridad '+p.start.selectionIndex);
          }
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
    if(b.appearances!==count*16)throw Error(`Unbalanced seat priority ${b.index}: ${b.appearances}`);
  }
  const priority=buckets(),seat=buckets();
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    const x=seatPriority[i][j];
    for(const [row] of [[seat[i]],[priority[j]]]){row.appearances+=x.appearances;row.wins+=x.wins;}
  }
  for(const b of [...priority,...seat]){
    b.winRate=b.wins/b.appearances;b.ci95=wilsonInterval(b.wins,b.appearances);
    if(b.appearances!==count*64)throw Error('Unbalanced aggregation');
  }
  variants[`${villagers}`]={...summarizeGames(games,DEFAULT_CIVS),priority,seat,seatPriority,perSeed};
  console.log(`Completed ${games.length} games with ${villagers} villagers`);
}
const results={experiment:'FFA60 priority 3 receives 1 military power; priority 4 receives zero',mapPreset:'ffa60',seeds,setup,
  profiles:DEFAULT_PROFILES,startingPositions:'Require two adjacent land hexes for both variants',
  notes:'40 seeds, four bot profiles, four civ rotations, four balanced CU order rotations; same CU legality as experiment H; priority 3 +1 military power and priority 4 0',
  variants};
const pct=n=>n==null?'—':(100*n).toFixed(1)+'%';
const v=variants.staggered;
const lines=['# Hito 3 — Experimento I: 3.º con +1 PM, 4.º sin PM','',
 `${count} mapas x 4 perfiles x 4 rotaciones civ x 4 prioridades = ${count*64} partidas.`,
 `Cada asiento tuvo cada prioridad ${count*16} veces. Se exige dos terrenos terrestres adyacentes para todos los CU.`,
 'Primero: 1 aldeano. Segundo: 2 aldeanos. Tercero: 3 aldeanos y 1 Poder Militar. Cuarto: 3 aldeanos y 0 Poder Militar.',
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
 '', 'El JSON incluye resultados por semilla y asiento. IC Wilson descriptivos: las partidas reutilizan mapas.',
 ''];
const baseline=JSON.parse(readFileSync('results/hito3-ffa60-power1-40.json','utf8')).variants.staggered;
const comparison=v.priority.map((p,i)=>({priority:i+1,baseline:baseline.priority[i].winRate,compensated:p.winRate,deltaPp:100*(p.winRate-baseline.priority[i].winRate)}));
results.comparison={against:'experiment H: third 0 PM and fourth 1 PM, same maps/profile/civ/priority order',priority:comparison};
lines.push('', '## Comparación con Experimento H', '',
 '| Prioridad | Experimento H | Experimento I | Cambio (pp) |',
 '|---|---:|---:|---:|',
 ...comparison.map(x=>`| ${x.priority}.ª | ${pct(x.baseline)} | ${pct(x.compensated)} | ${x.deltaPp>=0?'+':''}${x.deltaPp.toFixed(1)} |`));
// Each map contributes 64 games to both conditions, allowing a paired map-level comparison.
const oldRange=(Math.max(...baseline.priority.map(x=>x.winRate))-
               Math.min(...baseline.priority.map(x=>x.winRate)))*100;
const newRange=(Math.max(...v.priority.map(x=>x.winRate))-
               Math.min(...v.priority.map(x=>x.winRate)))*100;
const perSeedDelta=seeds.map((seed,i)=>({
  seed,
  oldPriorityWins:baseline.perSeed[i].priorityWins,
  newPriorityWins:v.perSeed[i].priorityWins,
  deltaPp:v.perSeed[i].priorityWins.map((w,k)=>100*(w-baseline.perSeed[i].priorityWins[k])/64)
}));
results.comparison.perSeed=perSeedDelta;
results.comparison.oldRangePp=oldRange;
results.comparison.newRangePp=newRange;
const meanAbsoluteDeviation=rows=>rows.reduce((sum,row)=>sum+Math.abs(row.winRate-0.25),0)/4*100;
results.comparison.oldMeanAbsoluteDeviationPp=meanAbsoluteDeviation(baseline.priority);
results.comparison.newMeanAbsoluteDeviationPp=meanAbsoluteDeviation(v.priority);
lines.push('', '## Desviación media frente al 25% ideal', '',
  `Experimento H: ${results.comparison.oldMeanAbsoluteDeviationPp.toFixed(2)} puntos porcentuales.`,
  `Experimento I: ${results.comparison.newMeanAbsoluteDeviationPp.toFixed(2)} puntos porcentuales.`);
lines.push('',
 '## Diferencia entre la mejor y la peor prioridad',
 '',
 `Experimento H: ${oldRange.toFixed(2)} puntos porcentuales.`,
 `Experimento I: ${newRange.toFixed(2)} puntos porcentuales.`,
 '',
 'Las diferencias por cada uno de los 40 mapas están incluidas en el JSON. Las rotaciones no equivalen a mapas independientes.');
mkdirSync('results',{recursive:true});
writeFileSync('results/hito3-ffa60-third-power1-40.md',lines.join('\\n').replaceAll('\\n','\n'));
writeFileSync('results/hito3-ffa60-third-power1-40.json',JSON.stringify(results,null,2)+'\n');
console.log(lines.join('\n'));
