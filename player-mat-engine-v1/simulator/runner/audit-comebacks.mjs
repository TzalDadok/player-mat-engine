import {mkdirSync,writeFileSync} from 'node:fs';
import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
import {BENCHMARK_SEEDS} from './benchmark-seeds.js';
import {balancedRandomCuOrders} from './run-cu-balanced-experiment.mjs';

const count=Math.max(1,Math.min(40,Number(process.argv[2]||40)));
const checkpoints=[8,12,16,20];
const setup=[{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:2,militaryPower:0,adjacentOnly:true},{villagers:2,militaryPower:1,adjacentOnly:true}];
const rotate=(xs,n)=>[...xs.slice(n),...xs.slice(0,n)];
const results=[];
const sums=arr=>arr.reduce((a,b)=>a+b,0);
const mean=arr=>arr.length?sums(arr)/arr.length:null;
const score=(p)=>p.militaryForce*2+p.militaryCount*2+p.villagers*2+p.buildings*3+p.technologies*2+p.territories+p.resources*.35+p.militaryPower*.5;
function snapshot(game){
 return game.state.players.map(p=>{
  const units=game.state.units.filter(u=>u.ownerId===p.id&&!u.embarkedIn&&!u.garrisonedIn);
  const army=units.filter(u=>game.effectiveUnitSpec(p.id,u.type).category==='military');
  const controlled=game.controlledHexIds(p.id);
  const resources=sums(controlled.flatMap(id=>game.hexMap.get(id)?.looseResources||[]).map(()=>1));
  const row={id:p.id,eliminated:p.eliminated,militaryCount:army.length,militaryForce:sums(army.map(u=>game.effectiveUnitSpec(p.id,u.type).force)),villagers:units.filter(u=>u.type==='villager').length,buildings:game.state.buildings.filter(b=>b.ownerId===p.id).length,technologies:p.technologies.length,territories:controlled.length,resources,militaryPower:p.militaryPower};
  row.score=score(row);return row;
 });
}
for(const seed of BENCHMARK_SEEDS.slice(0,count)){
 for(let rotation=0;rotation<4;rotation++){
  const civs=rotate(DEFAULT_CIVS,rotation);
  const orders=balancedRandomCuOrders(`balanced:${seed}:${rotation}`);
  for(const [orderIndex,cuSelectionOrder] of orders.entries()){
   const snapshots={};
   const g=runFFAGame({civs,seed,botSeed:`benchmark:balanced:${seed}`,profile:'balanced',maxRounds:400,mapPreset:'ffa60',cuSelectionOrder,startingSetupByPriority:setup,requireTwoAdjacentLand:true,onRoundSnapshot:(game,r)=>{if(checkpoints.includes(r))snapshots[r]=snapshot(game)}});
   if(g.status!=='completed')throw Error(`Incomplete: ${seed} ${rotation} ${orderIndex}`);
   const row={seed,rotation,orderIndex,rounds:g.rounds,winnerId:g.winnerId,checkpoints:{}};
   for(const round of checkpoints){
    const states=snapshots[round];
    if(!states)continue;
    const alive=states.filter(p=>!p.eliminated);
    if(alive.length<3)continue;
    const sorted=[...alive].sort((a,b)=>a.score-b.score);
    const winner=states.find(p=>p.id===g.winnerId);
    const winnerRank=sorted.findIndex(p=>p.id===g.winnerId)+1;
    const worst=sorted[0];
    const best=sorted.at(-1);
    const mid=sorted[Math.floor((sorted.length-1)/2)];
    const biggestArmy=sorted.reduce((a,b)=>a.militaryForce>=b.militaryForce?a:b);
    row.checkpoints[round]={alive:alive.length,winnerRank,winnerWasLast:worst.id===g.winnerId,winnerWasBelowMedian:winnerRank>0&&winner.score<=mid.score,
      worstWon:worst.id===g.winnerId,bestWon:best.id===g.winnerId,zeroArmyWins:alive.some(p=>p.id===g.winnerId&&p.militaryCount===0),
      zeroArmyCount:alive.filter(p=>p.militaryCount===0).length,scoreGap:best.score-worst.score,
      worstScore:worst.score,bestScore:best.score,winnerScore:winner?.score??null,highestArmyWon:biggestArmy.id===g.winnerId};
   }
   results.push(row);
  }
 }
 console.log(`Analyzed ${results.length} matches after ${seed}`);
}
const summary=checkpoints.map(round=>{
 const rows=results.map(g=>g.checkpoints[round]).filter(Boolean);
 return {round,observations:rows.length,lastPlaceWon:rows.filter(x=>x.worstWon).length,lastPlaceWinRate:mean(rows.map(x=>Number(x.worstWon))),bestPlaceWinRate:mean(rows.map(x=>Number(x.bestWon))),
  winnerHadZeroArmy:rows.filter(x=>x.zeroArmyWins).length,avgGap:mean(rows.map(x=>x.scoreGap)),avgAlive:mean(rows.map(x=>x.alive)),biggestArmyWinRate:mean(rows.map(x=>Number(x.highestArmyWon)))};
});
const f=n=>n===null?'—':(n*100).toFixed(1)+'%';
const report=['# Hito 5 — Auditoría de remontadas en FFA de cuatro jugadores','',
 `Muestra: ${results.length} partidas terminadas sobre ${count} mapas, cuatro rotaciones de civilizaciones y cuatro órdenes de CU. Perfil de bot: balanced. Configuración de inicio: experimento L.`,
 'Se mide una posición durante la partida, sin modificar decisiones. Solo se evalúan rondas que todavía tengan al menos tres jugadores vivos.',
 '',
 '## Indicador de ventaja, definido antes de calcular los resultados','',
 'Puntaje = 2×fuerza militar + 2×cantidad de unidades militares + 2×aldeanos + 3×edificios + 2×tecnologías + territorios controlados + 0,35×fichas controladas + 0,5×Poder Militar.',
 'Este puntaje es una aproximación de ventaja táctica/económica; no equivale a ventaja objetiva, ni garantiza que el líder vaya a ganar.',
 '',
 '## Remontadas observadas','',
 '| Ronda | Estados elegibles | Ganó el que estaba último | Ganó el que estaba primero | Ganó quien tenía más fuerza militar | Ganó alguien sin ejército |',
 '|---|---:|---:|---:|---:|---:|',
 ...summary.map(x=>`| ${x.round} | ${x.observations} | ${f(x.lastPlaceWinRate)} | ${f(x.bestPlaceWinRate)} | ${f(x.biggestArmyWinRate)} | ${x.winnerHadZeroArmy} |`),
 '', '## Interpretación',
 'Que gane el último según el puntaje demuestra que existe alguna posibilidad de remontada bajo las estrategias simuladas; no identifica por sí sola la regla causal. Es necesario estudiar secuencias concretas y las ventajas estructurales frente a humanos.',
 'La muestra reutiliza mapas y rotaciones; los porcentajes son descriptivos, no observaciones independientes.',
 ''];
mkdirSync('results',{recursive:true});
writeFileSync('results/hito5-comeback-audit.json',JSON.stringify({setup,seeds:count,summary,results},null,2)+'\n');
writeFileSync('results/hito5-comeback-audit.md',report.join('\n')+'\n');
console.log(report.join('\n'));
