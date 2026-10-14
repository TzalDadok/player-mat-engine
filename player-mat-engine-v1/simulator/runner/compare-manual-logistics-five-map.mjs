import {mkdirSync,writeFileSync} from 'node:fs';
import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
import {BENCHMARK_SEEDS} from './benchmark-seeds.js';
import {balancedRandomCuOrders} from './run-cu-balanced-experiment.mjs';
const max=Math.max(1,Math.min(40,Number(process.argv[2]||5)));
const variants=[
 {id:'actual',autoProduction:false,logisticsNetwork:false},
 {id:'red_completa_manual',autoProduction:false,logisticsNetwork:true}
];
const setup=[{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:2,militaryPower:0,adjacentOnly:true},{villagers:2,militaryPower:1,adjacentOnly:true}];
const sum=xs=>xs.reduce((a,b)=>a+b,0),mean=xs=>xs.length?sum(xs)/xs.length:null;
const rotate=(xs,n)=>[...xs.slice(n),...xs.slice(0,n)];
const observations=[];
function strength(game,id){
 const p=game.playerMap.get(id);
 const units=game.state.units.filter(u=>u.ownerId===id&&!u.embarkedIn&&!u.garrisonedIn);
 const army=units.filter(u=>game.effectiveUnitSpec(id,u.type).category==='military');
 const resources=game.controlledHexIds(id).flatMap(h=>game.hexMap.get(h)?.looseResources||[]).length;
 return sum(army.map(u=>game.effectiveUnitSpec(id,u.type).force))*2+army.length*2+
 units.filter(u=>u.type==='villager').length*2+
 game.state.buildings.filter(b=>b.ownerId===id).length*3+
 p.technologies.length*2+game.controlledHexIds(id).length+resources*.35+p.militaryPower*.5;
}
for(const seed of BENCHMARK_SEEDS.slice(0,max)){
 for(let rotation=0;rotation<4;rotation++){
  const civs=rotate(DEFAULT_CIVS,rotation),orders=balancedRandomCuOrders(`balanced:${seed}:${rotation}`);
  for(const [orderIndex,cuSelectionOrder] of orders.entries()){
   for(const v of variants){
    const checks={};
    const g=runFFAGame({civs,seed,botSeed:`benchmark:balanced:${seed}`,profile:'balanced',maxRounds:400,
     mapPreset:'ffa60',cuSelectionOrder,startingSetupByPriority:setup,requireTwoAdjacentLand:true,
     autoProduction:v.autoProduction,logisticsNetwork:v.logisticsNetwork,
     onRoundSnapshot:(game,r)=>{
      if([8,12,16,20].includes(r)){
       const alive=game.state.players.filter(p=>!p.eliminated);
       if(alive.length>=3){
        const ranking=alive.map(p=>({id:p.id,score:strength(game,p.id)})).sort((a,b)=>a.score-b.score);
        checks[r]={last:ranking[0].id,first:ranking.at(-1).id,alive:alive.length};
       }
      }
     }});
    const m={seed,rotation,orderIndex,variant:v.id,status:g.status,rounds:g.rounds,
      winnerId:g.winnerId,combats:g.combats,
      production:g.players.reduce((n,p)=>n+p.economy.totalProduced,0),
      spending:g.players.reduce((n,p)=>n+p.economy.totalSpent,0),
      buildings:g.players.reduce((n,p)=>n+p.buildingsAlive,0),
      units:g.players.reduce((n,p)=>n+p.unitsAlive,0),
      reachFeudal:g.players.filter(p=>p.age!=='dark').length,
      winnerFirst8:checks[8]?.first===g.winnerId,winnerLast8:checks[8]?.last===g.winnerId,
      checks:Object.fromEntries(Object.entries(checks).map(([k,vv])=>[k,{...vv,lastWon:g.winnerId===vv.last,firstWon:g.winnerId===vv.first}]))};
    observations.push(m);
   }
  }
 }
 console.log(`Completed seed ${seed} (${observations.length} simulations)`);
}
const summary=variants.map(v=>{
 const rows=observations.filter(x=>x.variant===v.id),done=rows.filter(x=>x.status==='completed');
 const checkpoints=Object.fromEntries([8,12,16,20].map(round=>{
  const elig=done.filter(x=>x.checks[round]);return [round,{eligible:elig.length,lastWins:elig.filter(x=>x.checks[round].lastWon).length,lastWinRate:mean(elig.map(x=>Number(x.checks[round].lastWon))),firstWinRate:mean(elig.map(x=>Number(x.checks[round].firstWon)))}]
 }));
 return {variant:v.id,played:rows.length,completed:done.length,avgRounds:mean(done.map(x=>x.rounds)),avgCombats:mean(rows.map(x=>x.combats)),avgProduction:mean(rows.map(x=>x.production)),avgSpending:mean(rows.map(x=>x.spending)),avgFeudalPlayers:mean(rows.map(x=>x.reachFeudal)),checkpoints};
});
const f=x=>x===null?'—':x.toFixed(2);
const lines=['# Hito 5 — Red logística completa sin producción automática','',
 `Muestra: ${max} mapas de 60 hexágonos, cuatro rotaciones y cuatro órdenes de elección por mapa; ${observations.length} ejecuciones (perfil balanced). Todas conservan los beneficios iniciales del Experimento L.`,
 'Variantes: **Actual** y **Red logística completa**. Ambas requieren PRODUCIR como acción económica. En la red, toda construcción, entrenamiento y avance pagado en un hex conectado puede gastar fichas situadas en cualquier otro hex controlado y conectado al CU.',
 'No hay producción automática en ninguna variante: agotamiento, bonificaciones y límites de producción son los actuales.',
 'La red habilita gastos de construcciones y unidades conectadas, además de tecnología y edad. Un destino aislado solo puede gastar sus recursos locales; los recursos fuera de la red no sirven para pagos conectados. El bot tiene acceso a los mismos cálculos de disponibilidad.',
 '', '## Partidas y economía','',
 '| Variante | Terminadas | Rondas promedio | Combates promedio | Recursos producidos | Recursos gastados | Jugadores en Feudal+ al final |',
 '|---|---:|---:|---:|---:|---:|---:|',
 ...summary.map(x=>`| ${x.variant} | ${x.completed}/${x.played} | ${f(x.avgRounds)} | ${f(x.avgCombats)} | ${f(x.avgProduction)} | ${f(x.avgSpending)} | ${f(x.avgFeudalPlayers)} |`),
 '', '## Remontadas (último en la ronda 12 o 20 que acaba ganador)','',
 '| Variante | R12 casos elegibles | R12 remontadas | R20 casos elegibles | R20 remontadas |',
 '|---|---:|---:|---:|---:|',
 ...summary.map(x=>`| ${x.variant} | ${x.checkpoints[12].eligible} | ${f(100*(x.checkpoints[12].lastWinRate||0))}% | ${x.checkpoints[20].eligible} | ${f(100*(x.checkpoints[20].lastWinRate||0))}% |`),
 '', 'Interpretación: los resultados comparan el comportamiento de un perfil de bot concreto, no demuestran balance entre jugadores humanos. El indicador de último usa una puntuación compuesta de ejército, aldeanos, edificios, tecnologías, control territorial, fichas y poder militar. Rotaciones de un mismo mapa no son observaciones independientes.',
 ''];
mkdirSync('results',{recursive:true});
writeFileSync('results/hito5-manual-logistics-five-map.md',lines.join('\n')+'\n');
writeFileSync('results/hito5-manual-logistics-five-map.json',JSON.stringify({setup,summary,observations},null,2)+'\n');
console.log(lines.join('\n'));
