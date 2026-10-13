import {mkdirSync,writeFileSync} from 'node:fs';
import {AoEGame} from '../engine/game.js';
import {hexDistance,physicalNeighbors} from '../engine/hex.js';
import {SOURCE_TO_RESOURCE,AGE_COSTS,RESOURCE_TYPES,AGE_PRODUCTION_LIMIT} from '../engine/constants.js';
import {BENCHMARK_SEEDS} from './benchmark-seeds.js';
import {balancedRandomCuOrders} from './run-cu-balanced-experiment.mjs';
const players=['P1','P2','P3','P4'];
const setup=[{villagers:1,power:0},{villagers:2,power:0},{villagers:3,power:1},{villagers:3,power:0}];
const policies=['produccion','expansion','edad'];
const goals={produccion:{food:1,wood:1,stone:1,gold:1},expansion:{food:2,wood:2,stone:1,gold:1},edad:{food:3,wood:2,stone:3,gold:2}};
const metrics=[];
const take=(game,id,fn)=>{try{fn();return true}catch(e){if(e?.name==='RuleError')return false;throw e}};
function resources(game,id){
 const totals=Object.fromEntries(RESOURCE_TYPES.map(t=>[t,0]));
 for(const hId of game.controlledHexIds(id)){const r=game.resourcesAt(hId);for(const t of RESOURCE_TYPES)totals[t]+=r[t]||0}
 return totals;
}
function sourceOptions(game,id){
 const villagers=game.state.units.filter(u=>u.ownerId===id&&u.type==='villager');
 const options=[];
 const seen=new Set();
 for(const u of villagers){
  const h=game.hexMap.get(u.hexId);
  const r=SOURCE_TO_RESOURCE[h?.source];
  if(r&&!seen.has(h.id)){seen.add(h.id);options.push({hexId:h.id,type:r})}
 }
 return options;
}
function economicAction(game,id,policy){
 const vill=game.state.units.filter(u=>u.ownerId===id&&u.type==='villager');
 const supplies=resources(game,id);
 const round=game.state.round;
 const target=goals[policy];
 const sources=sourceOptions(game,id);
 const available=game.state.hexes.filter(h=>!h.special&&h.terrain!=='water'&&SOURCE_TO_RESOURCE[h.source]);
 const wanted=t=>(target[t]||1)/(1+supplies[t]);
 const currentSourceTypes=new Set(sources.map(x=>x.type));
 const train=()=>vill.length< (policy==='expansion'?5:policy==='edad'?3:4) &&
     take(game,id,()=>game.trainUnits(id,[{type:'villager'}]));
 if(policy==='expansion'&&vill.length<4&&round>=3&&train())return 'train';
 if(policy==='edad'&&vill.length<2&&round>=4&&train())return 'train';
 // The producer may work at most two different tiles in Dark Age.
 const sorted=[...sources].sort((a,b)=>wanted(b.type)-wanted(a.type)||a.hexId.localeCompare(b.hexId));
 const produce=()=>sorted.length>0&&take(game,id,()=>game.produce(id,sorted.slice(0,AGE_PRODUCTION_LIMIT[game.playerMap.get(id).age]).map(x=>x.hexId)));
 // Movement chooses the best adjacent step toward a resource, not a full-path teleport.
 const moves=[];
 for(const u of vill){
  const from=game.hexMap.get(u.hexId);
  for(const h of physicalNeighbors(game.state.hexes,from.id)){
   if(h.terrain==='water'||h.special==='wonder'||h.special==='tc')continue;
   const resource=SOURCE_TO_RESOURCE[h.source];
   if(!resource)continue;
   const occupants=vill.filter(v=>v.hexId===h.id).length;
   const incumbent=SOURCE_TO_RESOURCE[from.source];
   const score=(resource?3:0)+3*wanted(resource)-occupants*2-(incumbent?2+2*wanted(incumbent):0);
   moves.push({unit:u,to:h,score});
  }
 }
 moves.sort((a,b)=>b.score-a.score||a.to.id.localeCompare(b.to.id));
 const movement=()=>{for(const c of moves){if(c.score<=0)break;
   if(take(game,id,()=>game.moveUnits(id,[c.unit.id],c.to.id)))return true;}return false};
 if(policy==='produccion'){
   if(sources.length===0&&movement())return 'move';
   if(produce())return 'produce';
   if(movement())return 'move';
   if(train())return 'train';
 }else if(policy==='expansion'){
   if((sources.length===0||currentSourceTypes.size<2)&&movement())return 'move';
   if(produce())return 'produce';
   if(movement())return 'move';
   if(train())return 'train';
 }else {
   // Spend a turn developing if current food/wood/stone are not represented near home.
   const value=sorted.reduce((a,x)=>a+wanted(x.type),0);
   if((sources.length===0||value<1.2)&&movement())return 'move';
   if(produce())return 'produce';
   if(movement())return 'move';
 }
 return 'pass';
}
function technologyAction(game,id,policy){
 if(policy==='edad' || (policy==='expansion'&&game.state.round>=6)){
  const p=game.playerMap.get(id);
  if(p.age==='dark'&&take(game,id,()=>game.advanceAge(id)))return 'advance-age';
 }
 const techs=game.availableTechnologies(id).sort((a,b)=>{
  const ka=JSON.stringify(a.effects||[]),kb=JSON.stringify(b.effects||[]);
  const weight=x=>/production|carry|movement|farm|cost/i.test(x)?0:1;
  return weight(ka)-weight(kb)||a.id.localeCompare(b.id);
 });
 if(policy!=='produccion'||game.state.round>=6)
  for(const t of techs){if(take(game,id,()=>game.research(id,t.id)))return 'research'}
 return 'pass';
}
function run(seed,order,policy,rotation){
 const civs=['britanicos','francos','vikingos','persas'];
 const game=AoEGame.createFFA({players:players.map((id,i)=>({id,civ:civs[(i+rotation)%4]})),seed,
    cuSelectionOrder:order,mapPreset:'ffa60',requireTwoAdjacentLand:true});
 const initial={};
 for(const p of game.state.players){
  const pr=game.state.mapMeta.startPositions.find(x=>x.playerId===p.id).selectionIndex;
  const cu=game.hexMap.get(p.tcHexId);
  const adj=game.state.hexes.filter(h=>!h.special&&h.terrain!=='water'&&hexDistance(h,cu)===1).sort((a,b)=>a.id.localeCompare(b.id));
  if(adj.length<2)throw Error('Illegal CU position');
  for(const h of adj.slice(0,setup[pr-1].villagers-1))game.addUnit(p.id,'villager',h.id);
  p.militaryPower=setup[pr-1].power;
  initial[p.id]={priority:pr,villagers:setup[pr-1].villagers,civ:p.civ};
 }
 const byPlayer=Object.fromEntries(players.map(id=>[id,{actions:{produce:0,move:0,train:0,pass:0,research:0,'advance-age':0},resourcesGenerated:0,resourceTypesProduced:new Set(),ageReached:null,firstProductionRound:null,roundsWithProduction:0}]));
 let phases=0;
 while(game.state.round<=10&&phases<200){
  const id=game.activePlayer.id,phase=game.state.phase,rec=byPlayer[id];
  if(phase==='economy'){
   const before=game.state.log.length;
   const action=economicAction(game,id,policy);
   rec.actions[action]=(rec.actions[action]||0)+1;
   const prod=game.state.log.slice(before).filter(x=>x.type==='produce');
   for(const x of prod){for(const y of (x.data?.results||[])){rec.resourcesGenerated+=y.amount||0;rec.resourceTypesProduced.add(y.resourceType)}}
   if(action==='produce'){rec.firstProductionRound??=game.state.round;rec.roundsWithProduction++}
  }else if(phase==='technology'){
   const action=technologyAction(game,id,policy);rec.actions[action]=(rec.actions[action]||0)+1;
   if(action==='advance-age')rec.ageReached??=game.state.round;
  }
  game.endPhase();phases++;
 }
 if(phases>=200)throw Error('Failed to complete 10 rounds');
 return game.state.players.map(p=>{
  const r=byPlayer[p.id],avail=resources(game,p.id);
  const log=game.state.log.filter(x=>x.playerId===p.id);
  let created=0,spent=0;
  for(const x of log){
   if(x.type==='produce')for(const row of(x.data?.results||[]))created+=row.amount||0;
   for(const n of Object.values(x.data?.paidCost||{}))spent+=Number(n)||0;
  }
  const res=Object.values(avail).reduce((a,b)=>a+b,0);
  return {seed,order:order.join('>'),policy,seat:Number(p.id.slice(1)),civ:p.civ,priority:initial[p.id].priority,initialVillagers:initial[p.id].villagers,
    age:p.age,feudalBy10:p.age!=='dark',ageReached:r.ageReached,villagersAt10:game.state.units.filter(u=>u.ownerId===p.id&&u.type==='villager').length,
    militaryPower:p.militaryPower,controlledResources:res,resourcesByType:avail,
    productionActions:r.actions.produce||0,movementActions:r.actions.move||0,trainingActions:r.actions.train||0,
    economicPasses:r.actions.pass||0,firstProductionRound:r.firstProductionRound,
    roundsWithProduction:r.roundsWithProduction,producedTypes:[...r.resourceTypesProduced],resourceTokensGenerated:created,
    techs:p.technologies.length,spentResources:spent,buildings:game.state.buildings.filter(b=>b.ownerId===p.id).length};
 });
}
const seeds=BENCHMARK_SEEDS.slice(0,Math.max(1,Math.min(40,Number(process.argv[2]||40))));
for(const seed of seeds){
 for(const order of balancedRandomCuOrders('human10:'+seed)){
  for(const policy of policies)metrics.push(...run(seed,order,policy,0));
 }
}
const mean=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
const summarized=policies.map(policy=>({policy,byPriority:setup.map((cfg,i)=>{
 const rows=metrics.filter(r=>r.policy===policy&&r.priority===i+1);
 const keys=['controlledResources','resourceTokensGenerated','movementActions','trainingActions','productionActions','economicPasses','villagersAt10','spentResources','techs','roundsWithProduction'];
 return {priority:i+1,startsWith:cfg,observations:rows.length,feudalBy10:mean(rows.map(x=>Number(x.feudalBy10))),
   ...Object.fromEntries(keys.map(k=>[k,mean(rows.map(x=>x[k]))]))};
})}));
const fmt=n=>n.toFixed(2);
const lines=['# Hito 4 — Comparación de aperturas económicas en diez rondas','',
 'Se ejecutaron secuencias de acciones legales del motor para cuatro jugadores, sin combatir entre ellos, en los mismos 40 mapas.',
 'Cada mapa usa cuatro órdenes de elección de CU y tres políticas de decisión distintas. No se usan tasas de victoria.',
 '',
 '**Alcance:** son tres planes heurísticos reproducibles, NO una optimización exhaustiva ni una prueba de juego humano.',
 'Se ejecutan PRODUCIR, MOVER, ENTRENAR, INVESTIGAR y AVANZAR EDAD cuando el motor permite la acción. No se modelan construcciones ni transporte deliberado; tampoco combate.',
 '',
 '## Resultados por prioridad y plan','',
 '| Plan | Prioridad | Recursos controlados al final | Recursos generados | Acciones mover | Acciones producir | Aldeanos al final | Feudal al turno 10 |',
 '|---|---:|---:|---:|---:|---:|---:|---:|',
 ...summarized.flatMap(x=>x.byPriority.map(y=>`| ${x.policy} | ${y.priority} | ${fmt(y.controlledResources)} | ${fmt(y.resourceTokensGenerated)} | ${fmt(y.movementActions)} | ${fmt(y.productionActions)} | ${fmt(y.villagersAt10)} | ${(100*y.feudalBy10).toFixed(1)}% |`)),
 '', '## Limitaciones importantes','',
 'La logística del juego se representa parcialmente en el motor: los costes tecnológicos pueden consumir fichas de los territorios controlados sin transportarlas al CU, mientras la construcción y unidades militares exigen pago local. No debe interpretarse la comparación como una prueba completa de transportes.',
 'No se considera el coste de oportunidad militar, las tecnologías alternativas de alto valor ni la estrategia adaptativa de un humano con información parcial.',
 'La ausencia de acciones de CONSTRUIR y del transporte intencional impide optimizar el juego completo; los resultados sirven como diagnóstico de economía de apertura, no como balance definitivo.',
 ''];
mkdirSync('results',{recursive:true});
writeFileSync('results/hito4-opening-plans-10.md',lines.join('\n')+'\n');
writeFileSync('results/hito4-opening-plans-10.json',JSON.stringify({seeds,setup,policies,summarized,metrics},null,2)+'\n');
console.log(lines.join('\n'));
