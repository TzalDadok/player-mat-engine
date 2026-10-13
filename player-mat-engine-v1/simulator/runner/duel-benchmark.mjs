import { runFFAGame, DEFAULT_CIVS } from './simulate.js';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';
import { DEFAULT_PROFILES } from './benchmark.mjs';

function pairings(civs){
  const out=[];
  for(let i=0;i<civs.length;i++){
    for(let j=i+1;j<civs.length;j++){
      out.push([civs[i],civs[j]]);
    }
  }
  return out;
}

function key(a,b){
  return [a,b].sort().join('__vs__');
}

export function runDuelBenchmark({
  seeds=BENCHMARK_SEEDS,
  civs=DEFAULT_CIVS,
  profiles=DEFAULT_PROFILES,
  maxRounds=250
}={}){
  const games=[];
  const pairs=pairings(civs);

  for(const profile of profiles){
    for(const seed of seeds){
      for(const [a,b] of pairs){
        for(const order of [[a,b],[b,a]]){
          const result=runFFAGame({
            civs:order,
            seed:`duel:${seed}:${key(a,b)}`,
            botSeed:`duel:${profile}:${seed}:${key(a,b)}`,
            profile,
            maxRounds
          });
          result.profile=profile;
          result.matchup=key(a,b);
          result.order=[...order];
          games.push(result);
        }
      }
    }
  }

  const matchups={};

  for(const [a,b] of pairs){
    const id=key(a,b);
    const rows=games.filter(g=>g.matchup===id);
    const wins={[a]:0,[b]:0};
    const appearances={[a]:0,[b]:0};

    for(const game of rows){
      for(const p of game.players){
        appearances[p.civ]++;
        if(game.winnerId===p.id)wins[p.civ]++;
      }
    }

    matchups[id]={
      civs:[a,b],
      games:rows.length,
      completed:rows.filter(g=>g.status==='completed').length,
      completionRate:rows.length
        ? rows.filter(g=>g.status==='completed').length/rows.length
        : 0,
      wins,
      winRates:{
        [a]:appearances[a]?wins[a]/appearances[a]:0,
        [b]:appearances[b]?wins[b]/appearances[b]:0
      }
    };
  }

  const byProfile={};
  for(const profile of profiles){
    const rows=games.filter(g=>g.profile===profile);
    byProfile[profile]={
      games:rows.length,
      completed:rows.filter(g=>g.status==='completed').length,
      completionRate:rows.length
        ? rows.filter(g=>g.status==='completed').length/rows.length
        : 0
    };
  }

  return {
    seeds:[...seeds],
    profiles:[...profiles],
    games:games.length,
    completed:games.filter(g=>g.status==='completed').length,
    completionRate:games.length
      ? games.filter(g=>g.status==='completed').length/games.length
      : 0,
    matchups,
    byProfile,
    results:games
  };
}

const isDirect=
  process.argv[1] &&
  import.meta.url===new URL(`file://${process.argv[1]}`).href;

if(isDirect){
  const count=Math.max(
    1,
    Math.min(BENCHMARK_SEEDS.length,Number(process.argv[2]||3))
  );
  const result=runDuelBenchmark({
    seeds:BENCHMARK_SEEDS.slice(0,count)
  });
  console.log(JSON.stringify({
    seeds:count,
    games:result.games,
    completed:result.completed,
    completionRate:result.completionRate,
    matchups:result.matchups,
    byProfile:result.byProfile
  },null,2));
}
