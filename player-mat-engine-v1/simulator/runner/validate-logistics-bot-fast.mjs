import {runFFAGame,DEFAULT_CIVS} from './simulate.js';
const setup=[
  {villagers:1,militaryPower:1,adjacentOnly:true},
  {villagers:1,militaryPower:1,adjacentOnly:true},
  {villagers:2,militaryPower:0,adjacentOnly:true},
  {villagers:2,militaryPower:1,adjacentOnly:true}
];
const started=performance.now();
for(const enabled of [false,true]){
 const r=runFFAGame({
   civs:DEFAULT_CIVS,seed:'bench-001',botSeed:'benchmark:balanced:bench-001',
   profile:'balanced',maxRounds:400,mapPreset:'ffa60',
   startingSetupByPriority:setup,requireTwoAdjacentLand:true,
   logisticsNetwork:enabled,autoProduction:false
 });
 const sec=(performance.now()-started)/1000;
 console.log(JSON.stringify({logistics:enabled,status:r.status,rounds:r.rounds,steps:r.steps,combats:r.combats,secondsElapsed:Number(sec.toFixed(2))}));
 if(!['completed','max-rounds','max-steps'].includes(r.status))throw Error('Unknown status');
}
