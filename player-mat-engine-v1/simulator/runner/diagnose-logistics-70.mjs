import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
const setup=[{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:2,militaryPower:0,adjacentOnly:true},{villagers:2,militaryPower:1,adjacentOnly:true}];
for(const logisticsNetwork of [false,true]){
 const g=runFFAGame({civs:DEFAULT_CIVS,seed:'bench-001',botSeed:'diagnostic:001',profile:'balanced',maxRounds:70,mapPreset:'ffa60',startingSetupByPriority:setup,requireTwoAdjacentLand:true,logisticsNetwork,autoProduction:false});
 console.log(JSON.stringify({logisticsNetwork,status:g.status,rounds:g.rounds,combats:g.combats,players:g.players.map(p=>({id:p.id,barracksAt:p.milestones.firstBarracks,militaryAt:p.milestones.firstMilitary,trained:p.militaryTrained,produced:p.economy.totalProduced,spent:p.economy.totalSpent,bot:p.bot}))}));
}
