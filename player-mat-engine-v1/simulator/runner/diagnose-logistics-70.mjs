import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
const setup=[{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:1,militaryPower:1,adjacentOnly:true},{villagers:2,militaryPower:0,adjacentOnly:true},{villagers:2,militaryPower:1,adjacentOnly:true}];
for(const logisticsNetwork of [true]){
 for(const seed of ['bench-001','bench-002','bench-003']){
 const g=runFFAGame({civs:DEFAULT_CIVS,seed,botSeed:'diagnostic:'+seed,profile:'balanced',maxRounds:70,mapPreset:'ffa60',startingSetupByPriority:setup,requireTwoAdjacentLand:true,logisticsNetwork,autoProduction:false,onRoundSnapshot:(game,round)=>{if(logisticsNetwork&&[10,25,50,70].includes(round)){console.log(JSON.stringify({round,players:game.state.players.map(p=>{const linked=game.logisticsConnectedHexIds(p.id),controlled=game.controlledHexIds(p.id);const resources=(ids)=>ids.reduce((a,id)=>{const r=game.resourcesAt(id);for(const k of Object.keys(a))a[k]+=r[k]||0;return a},{food:0,wood:0,stone:0,gold:0});return{id:p.id,villagers:game.state.units.filter(u=>u.ownerId===p.id&&u.type==='villager').map(u=>u.hexId),controlled:controlled.length,linked:linked.length,total:resources(controlled),connected:resources(linked),buildings:game.state.buildings.filter(b=>b.ownerId===p.id).map(b=>({type:b.type,hexId:b.hexId}))}})}))}}});
 console.log(JSON.stringify({seed,logisticsNetwork,status:g.status,rounds:g.rounds,combats:g.combats,players:g.players.map(p=>({id:p.id,barracksAt:p.milestones.firstBarracks,militaryAt:p.milestones.firstMilitary,trained:p.militaryTrained,produced:p.economy.totalProduced,spent:p.economy.totalSpent,bot:p.bot}))}));
}

}
