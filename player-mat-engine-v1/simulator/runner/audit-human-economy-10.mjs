import {mkdirSync,writeFileSync} from 'node:fs';
import {AoEGame} from '../engine/game.js';
import {hexDistance} from '../engine/hex.js';
import {BENCHMARK_SEEDS} from './benchmark-seeds.js';
import {balancedRandomCuOrders} from './run-cu-balanced-experiment.mjs';
import {SOURCE_TO_RESOURCE,AGE_PRODUCTION_LIMIT} from '../engine/constants.js';

const PLAYERS=['P1','P2','P3','P4'];
const SETUP=[{villagers:1,power:0},{villagers:2,power:0},{villagers:3,power:1},{villagers:3,power:0}];
const rollups=Array.from({length:4},(_,i)=>({priority:i+1,count:0,startsProductive:[],productionNow:[],productionAfterOneMove:[],productiveNeighbors:[],foodDistance:[],woodDistance:[],goldDistance:[],stoneDistance:[],distinctResourceTypesTwoSteps:[],distanceToClosestSource:[],initialLocations:[]}));
const perMap=[];
const neighbors=(hexes,h)=>hexes.filter(other=>hexDistance(h,other)===1 && other.terrain!=='water' && other.special!=='wonder');
function bfs(hexes,start){
 const queue=[start],dist=new Map([[start.id,0]]);
 for(let k=0;k<queue.length;k++){
  const here=queue[k];
  for(const next of neighbors(hexes,here)){
   if(!dist.has(next.id)){dist.set(next.id,dist.get(here.id)+1);queue.push(next)}
  }
 }
 return dist;
}
function topTwoFromPositions(hexes,positions){
 const byHex=new Map();
 for(const id of positions){
  const h=hexes.find(x=>x.id===id);if(!h)throw Error('Starting hex missing '+id);
  const source=SOURCE_TO_RESOURCE[h.source];
  if(source){byHex.set(id,(byHex.get(id)||0)+1)}
 }
 return [...byHex.values()].sort((a,b)=>b-a).slice(0,AGE_PRODUCTION_LIMIT.dark).reduce((a,b)=>a+b,0);
}
for(const seed of BENCHMARK_SEEDS.slice(0,40)){
 const rows=[];
 // Four cyclic orders let every seat occupy each priority, holding the physical map seed constant.
 const orders=balancedRandomCuOrders('economy:'+seed);
 for(const order of orders){
  const game=AoEGame.createFFA({players:PLAYERS.map(id=>({id,civ:'britanicos'})),seed,mapPreset:'ffa60',cuSelectionOrder:order,requireTwoAdjacentLand:true});
  const hexes=game.state.hexes;
  for(const player of game.state.players){
   const start=game.state.mapMeta.startPositions.find(p=>p.playerId===player.id);
   const index=start.selectionIndex-1;
   const cu=hexes.find(h=>h.id===player.tcHexId);
   const adj=neighbors(hexes,cu).filter(h=>!h.special).sort((a,b)=>a.id.localeCompare(b.id));
   if(adj.length<2)throw Error('CU without two adjacent land tiles');
   const positions=[cu.id,...adj.slice(0,SETUP[index].villagers-1).map(h=>h.id)];
   const sourceHexes=hexes.filter(h=>!h.special&&SOURCE_TO_RESOURCE[h.source]&&h.terrain!=='water');
   const distances=positions.map(id=>bfs(hexes,hexes.find(h=>h.id===id)));
   const resourceDistance=type=>{
    const ds=sourceHexes.filter(h=>SOURCE_TO_RESOURCE[h.source]===type).flatMap(h=>distances.map(d=>d.get(h.id))).filter(Number.isFinite);
    return ds.length?Math.min(...ds):null;
   };
   const sourceD=sourceHexes.flatMap(h=>distances.map(d=>d.get(h.id))).filter(Number.isFinite);
   const closestSource=sourceD.length?Math.min(...sourceD):null;
   const productiveTypes=new Set(sourceHexes.filter(h=>distances.some(d=>(d.get(h.id)??Infinity)<=2)).map(h=>SOURCE_TO_RESOURCE[h.source]));
   const initial=topTwoFromPositions(hexes,positions);
   // Optimistic upper bound: one economic action moves a single villager one hex, and a later action produces.
   let bestAfterMove=initial;
   for(let j=0;j<positions.length;j++){
    const from=hexes.find(h=>h.id===positions[j]);
    for(const to of neighbors(hexes,from).filter(h=>!h.special)){
     const moved=[...positions];moved[j]=to.id;
     bestAfterMove=Math.max(bestAfterMove,topTwoFromPositions(hexes,moved));
    }
   }
   const data={seed,priority:index+1,seat:Number(player.id.slice(1)),villagers:positions.length,
    startsProductive:positions.filter(id=>!!SOURCE_TO_RESOURCE[hexes.find(h=>h.id===id).source]).length,
    productionNow:initial,productionAfterOneMove:bestAfterMove,
    productiveNeighbors:adj.filter(h=>SOURCE_TO_RESOURCE[h.source]).length,
    foodDistance:resourceDistance('food'),woodDistance:resourceDistance('wood'),
    goldDistance:resourceDistance('gold'),stoneDistance:resourceDistance('stone'),
    distinctResourceTypesTwoSteps:productiveTypes.size,distanceToClosestSource:closestSource,
    initialLocations:positions};
   rows.push(data);
   const bucket=rollups[index];bucket.count++;
   for(const key of Object.keys(data)){
    if(Array.isArray(bucket[key]))bucket[key].push(data[key]);
   }
  }
 }
 perMap.push({seed,rows});
}
const mean=values=>{const v=values.filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
const summary=rollups.map(({priority,count,...arrays})=>({priority,count,...Object.fromEntries(Object.entries(arrays).filter(([k])=>k!=='initialLocations').map(([key,v])=>[key,mean(v)]))}));
const result={analysis:'FFA60 opening economy geometry 10-round action budget',seeds:40,placements:perMap.length*4,
  warning:'Economic-access metrics and optimistic 1-move output, not an optimal 10-round playthrough; production tokens, buildings, technology, resource transport and enemy activity not modeled.',
  phases:{economicActionsFirst10Rounds:10,technologyActionsFirst10Rounds:10,militaryActionsFirst10Rounds:10,initialProductionHexLimit:AGE_PRODUCTION_LIMIT.dark},
  setup:SETUP,summary,perMap};
const num=x=>Number.isFinite(x)?x.toFixed(2):'—';
const lines=['# Hito 4 — Auditoría de acceso económico inicial (40 mapas, FFA60)','',
 'Se analizaron 40 mapas con 4 órdenes de elección de CU por mapa y 4 asientos por orden; 640 inicios medidos.',
 'Los aldeanos se ubican como en el simulador: CU y hasta dos hexágonos terrestres vecinos, ordenados por ID.',
 '', '**Esta prueba mide oportunidades iniciales y límites de acciones, no simula todavía una estrategia óptima de 10 rondas.**',
 '', '## Restricción de las primeras diez rondas',
 '- 10 acciones económicas como máximo; PRODUCIR, MOVER y CONSTRUIR compiten por esas acciones.',
 '- En Alta Edad Media, cada acción PRODUCIR puede seleccionar hasta 2 hexágonos productivos.',
 '- Los aldeanos adicionales no sustituyen acciones de movimiento, investigación, construcción ni transporte.',
 '', '## Acceso inicial por prioridad','',
 '| Prioridad | Aldeanos | Aldeanos en recurso (inicio) | Producción inmediata máxima (por acción) | Máxima tras 1 movimiento (por acción) | Distancia media mínima a comida | madera | oro | piedra | Tipos accesibles a 2 pasos |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
 ...summary.map(x=>`| ${x.priority}.ª | ${SETUP[x.priority-1].villagers} | ${num(x.startsProductive)} | ${num(x.productionNow)} | ${num(x.productionAfterOneMove)} | ${num(x.foodDistance)} | ${num(x.woodDistance)} | ${num(x.goldDistance)} | ${num(x.stoneDistance)} | ${num(x.distinctResourceTypesTwoSteps)} |`),
 '', '## Limitaciones y siguiente paso',
 'La producción inicial calculada se basa en Aldeanos sobre fuentes y un máximo de 2 hexágonos por acción. No descuenta agotamiento, cambios de estado de recursos ni considera edificios, tecnologías, consumo, transporte o combate.',
 'El máximo tras un movimiento es un límite optimista de producción por acción, no un total de recursos durante las primeras diez rondas.',
 'Para comparar desarrollo humano real a 10 rondas falta construir un planificador de acciones legales por civilización que optimice varios objetivos (economía, edad y defensa) y contabilice el traslado de recursos.',
 ''];
mkdirSync('results',{recursive:true});
writeFileSync('results/hito4-human-economy-10-audit.json',JSON.stringify(result,null,2)+'\n');
writeFileSync('results/hito4-human-economy-10-audit.md',lines.join('\n')+'\n');
console.log(lines.join('\n'));
