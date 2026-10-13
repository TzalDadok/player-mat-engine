import { runFFAGame, DEFAULT_CIVS } from './simulate.js';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';

function rotate(values,n){
  const k=((n%values.length)+values.length)%values.length;
  return [...values.slice(k),...values.slice(0,k)];
}

export function runBenchmark({
  seeds = BENCHMARK_SEEDS,
  civs = DEFAULT_CIVS,
  maxRounds = 250,
  aggression = 0.2,
  maxVillagers = 4
} = {}) {
  const games=[];

  seeds.forEach((seed,seedIndex)=>{
    for(let seatRotation=0; seatRotation<civs.length; seatRotation++){
      const order=rotate(civs,seatRotation);
      games.push(runFFAGame({
        civs:order,
        seed,
        botSeed:`benchmark:${seed}`,
        maxRounds,
        aggression,
        maxVillagers
      }));
    }
  });

  const wins=Object.fromEntries(civs.map(c=>[c,0]));
  const appearances=Object.fromEntries(civs.map(c=>[c,0]));
  const seatWins=Array.from({length:civs.length},()=>0);
  const statuses={};

  for(const game of games){
    statuses[game.status]=(statuses[game.status]||0)+1;
    game.players.forEach((p,seat)=>{
      appearances[p.civ]=(appearances[p.civ]||0)+1;
      if(game.winnerId===p.id){
        wins[p.civ]=(wins[p.civ]||0)+1;
        seatWins[seat]++;
      }
    });
  }

  const civSummary=Object.fromEntries(civs.map(c=>[
    c,
    {
      appearances:appearances[c],
      wins:wins[c],
      winRate:appearances[c]?wins[c]/appearances[c]:0
    }
  ]));

  return {
    seeds:[...seeds],
    games:games.length,
    completed:games.filter(g=>g.status==='completed').length,
    completionRate:games.length?games.filter(g=>g.status==='completed').length/games.length:0,
    statuses,
    civs:civSummary,
    seatWins,
    results:games
  };
}

const isDirect = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if(isDirect){
  const seedCount=Math.max(1,Math.min(BENCHMARK_SEEDS.length,Number(process.argv[2]||10)));
  const result=runBenchmark({seeds:BENCHMARK_SEEDS.slice(0,seedCount)});
  console.log(JSON.stringify({
    seeds:seedCount,
    games:result.games,
    completed:result.completed,
    completionRate:result.completionRate,
    statuses:result.statuses,
    civs:result.civs,
    seatWins:result.seatWins
  },null,2));
}
