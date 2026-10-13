import { runFFAGame, DEFAULT_CIVS } from './simulate.js';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';

export const DEFAULT_PROFILES = [
  'balanced',
  'aggressive',
  'economic',
  'technological'
];

function rotate(values,n){
  const k=((n%values.length)+values.length)%values.length;
  return [...values.slice(k),...values.slice(0,k)];
}

function mean(values){
  const valid=values.filter(v=>Number.isFinite(v));
  return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null;
}

function emptyCivSummary(civs){
  return Object.fromEntries(civs.map(c=>[
    c,
    {
      appearances:0,
      wins:0,
      winRate:0,
      avgMilitaryTrained:0,
      avgVillagersTrained:0,
      avgTechnologies:0,
      avgFirstBarracks:null,
      avgFirstMilitary:null,
      avgFirstCombat:null,
      avgFeudal:null,
      avgCastles:null,
      avgImperial:null
    }
  ]));
}

function summarizeGames(games,civs){
  const civSummary=emptyCivSummary(civs);
  const samples=Object.fromEntries(civs.map(c=>[c,[]]));
  const seatWins=Array.from({length:civs.length},()=>0);
  const statuses={};

  for(const game of games){
    statuses[game.status]=(statuses[game.status]||0)+1;

    game.players.forEach((p,seat)=>{
      const row=civSummary[p.civ] || (civSummary[p.civ]={
        appearances:0,wins:0,winRate:0
      });

      row.appearances++;
      (samples[p.civ] || (samples[p.civ]=[])).push(p);

      if(game.winnerId===p.id){
        row.wins++;
        seatWins[seat]++;
      }
    });
  }

  for(const [civ,row] of Object.entries(civSummary)){
    const s=samples[civ] || [];
    row.winRate=row.appearances ? row.wins/row.appearances : 0;
    row.avgMilitaryTrained=mean(s.map(p=>p.militaryTrained)) ?? 0;
    row.avgVillagersTrained=mean(s.map(p=>p.villagersTrained)) ?? 0;
    row.avgTechnologies=mean(s.map(p=>p.technologies)) ?? 0;
    row.avgFirstBarracks=mean(s.map(p=>p.milestones?.firstBarracks));
    row.avgFirstMilitary=mean(s.map(p=>p.milestones?.firstMilitary));
    row.avgFirstCombat=mean(s.map(p=>p.milestones?.firstCombat));
    row.avgFeudal=mean(s.map(p=>p.milestones?.feudal));
    row.avgCastles=mean(s.map(p=>p.milestones?.castles));
    row.avgImperial=mean(s.map(p=>p.milestones?.imperial));
  }

  return {
    games:games.length,
    completed:games.filter(g=>g.status==='completed').length,
    completionRate:games.length
      ? games.filter(g=>g.status==='completed').length/games.length
      : 0,
    statuses,
    civs:civSummary,
    seatWins
  };
}

export function runBenchmark({
  seeds = BENCHMARK_SEEDS,
  civs = DEFAULT_CIVS,
  profiles = DEFAULT_PROFILES,
  maxRounds = 300
} = {}) {
  const games=[];

  for(const profile of profiles){
    seeds.forEach(seed=>{
      for(let seatRotation=0; seatRotation<civs.length; seatRotation++){
        const order=rotate(civs,seatRotation);

        const result=runFFAGame({
          civs:order,
          seed,
          botSeed:`benchmark:${profile}:${seed}`,
          profile,
          maxRounds
        });

        result.profile=profile;
        result.seatRotation=seatRotation;
        games.push(result);
      }
    });
  }

  const overall=summarizeGames(games,civs);
  const byProfile={};

  for(const profile of profiles){
    byProfile[profile]=summarizeGames(
      games.filter(g=>g.profile===profile),
      civs
    );
  }

  return {
    seeds:[...seeds],
    profiles:[...profiles],
    ...overall,
    byProfile,
    results:games
  };
}

const isDirect =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if(isDirect){
  const seedCount=Math.max(
    1,
    Math.min(BENCHMARK_SEEDS.length,Number(process.argv[2]||5))
  );
  const profileArg=process.argv[3] || 'all';
  const profiles=
    profileArg==='all'
      ? DEFAULT_PROFILES
      : profileArg.split(',').filter(Boolean);

  const result=runBenchmark({
    seeds:BENCHMARK_SEEDS.slice(0,seedCount),
    profiles
  });

  console.log(JSON.stringify({
    seeds:seedCount,
    profiles,
    games:result.games,
    completed:result.completed,
    completionRate:result.completionRate,
    statuses:result.statuses,
    civs:result.civs,
    seatWins:result.seatWins,
    byProfile:result.byProfile
  },null,2));
}
