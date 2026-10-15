import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
const setup=[{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:2,militaryPower:0,adjacentOnly:true},{villagers:2,militaryPower:1,adjacentOnly:true}];
const rounds=90;
const observations=[];
for(let index=1;index<=10;index++){
 const seed='bench-'+String(index).padStart(3,'0');
 const result=runFFAGame({civs:DEFAULT_CIVS,seed,botSeed:'diagnostic:'+seed,
   profile:'balanced',maxRounds:rounds,mapPreset:'ffa60',startingSetupByPriority:setup,
   requireTwoAdjacentLand:true,logisticsNetwork:true,autoProduction:false});
 const built=result.players.filter(p=>p.milestones.firstBarracks!==null).length;
 const trained=result.players.filter(p=>p.milestones.firstMilitary!==null).length;
 observations.push({seed,status:result.status,rounds:result.rounds,built,trained,
   combats:result.combats,resourcesSpent:result.players.reduce((n,p)=>n+p.economy.totalSpent,0)});
 console.log(JSON.stringify(observations.at(-1)));
}
const built=observations.reduce((n,x)=>n+x.built,0);
const trained=observations.reduce((n,x)=>n+x.trained,0);
console.log(JSON.stringify({overall:{games:10,players:40,built,trained,
  combats:observations.reduce((n,x)=>n+x.combats,0)},observations}));
if(built<36||trained<20||observations.reduce((n,x)=>n+x.combats,0)===0)
  throw new Error('Logistics regression: expected at least 36 barracks, 20 armies and one combat');
