import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
import {balancedRandomCuOrders} from './run-cu-balanced-experiment.mjs';
const setup=[{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:2,militaryPower:0,adjacentOnly:true},{villagers:2,militaryPower:0,adjacentOnly:true}];
const seeds=['bench-021','bench-025','bench-026','bench-037','bench-040'];
const profile='balanced',rotation=0;
for(const seed of seeds){
 const order=balancedRandomCuOrders(`${profile}:${seed}:${rotation}`)[0];
 const g=runFFAGame({civs:DEFAULT_CIVS,seed,botSeed:`benchmark:${profile}:${seed}`,profile,maxRounds:400,mapPreset:'ffa60',cuSelectionOrder:order,startingSetupByPriority:setup,requireTwoAdjacentLand:true});
 console.log(JSON.stringify({seed,status:g.status,rounds:g.rounds,winner:g.winnerId,players:g.players.map(p=>({id:p.id,priority:p.start.selectionIndex,eliminated:p.eliminated,units:p.unitsAlive,buildings:p.buildingsAlive,produced:p.economy?.totalProduced,spent:p.economy?.totalSpent,militaryTrained:p.militaryTrained,passes:p.bot?.passes})),stall:g.stall?{alive:g.stall.alivePlayers,categories:g.stall.categories,players:g.stall.players,recent:g.stall.recentLog.slice(-12).map(x=>({type:x.type,round:x.round,playerId:x.playerId})),starts:g.stall.starts}:null}));
}
