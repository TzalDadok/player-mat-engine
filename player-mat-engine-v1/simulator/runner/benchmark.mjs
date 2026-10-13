import { runFFAGame, DEFAULT_CIVS } from './simulate.js';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';

export const DEFAULT_PROFILES = [
  'balanced',
  'aggressive',
  'economic',
  'technological'
];

const Z_95 = 1.959963984540054;

function rotate(values,n){
  const k=((n%values.length)+values.length)%values.length;
  return [...values.slice(k),...values.slice(0,k)];
}

function mean(values){
  const valid=values.filter(v=>Number.isFinite(v));
  return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null;
}

export function wilsonInterval(successes,total,z=Z_95){
  if(!total) return null;

  const p=successes/total;
  const z2=z*z;
  const den=1+z2/total;
  const center=(p+z2/(2*total))/den;
  const half=(z*Math.sqrt((p*(1-p)+z2/(4*total))/total))/den;

  return {
    low:Math.max(0,center-half),
    high:Math.min(1,center+half)
  };
}

function emptyCivSummary(civs){
  return Object.fromEntries(civs.map(c=>[
    c,
    {
      appearances:0,
      completedAppearances:0,
      incompleteAppearances:0,
      wins:0,
      losses:0,
      winRate:null,
      winRateCI95:null,
      avgMilitaryTrained:0,
      avgVillagersTrained:0,
      avgTechnologies:0,
      avgFirstBarracks:null,
      avgFirstMilitary:null,
      avgFirstCombat:null,
      avgFeudal:null,
      avgCastles:null,
      avgImperial:null,
      avgStartScore:null,
      avgCombats:null,
      avgCombatWins:null,
      avgAttacks:null,
      avgAttackWins:null,
      avgEliminatedRound:null,
      avgProduced:null,
      avgSpent:null,
      avgFoodProduced:null,
      avgWoodProduced:null,
      avgStoneProduced:null,
      avgGoldProduced:null
    }
  ]));
}

function aggregatePlayerMetrics(row,samples){
  row.avgMilitaryTrained=mean(samples.map(p=>p.militaryTrained)) ?? 0;
  row.avgVillagersTrained=mean(samples.map(p=>p.villagersTrained)) ?? 0;
  row.avgTechnologies=mean(samples.map(p=>p.technologies)) ?? 0;
  row.avgFirstBarracks=mean(samples.map(p=>p.milestones?.firstBarracks));
  row.avgFirstMilitary=mean(samples.map(p=>p.milestones?.firstMilitary));
  row.avgFirstCombat=mean(samples.map(p=>p.milestones?.firstCombat));
  row.avgFeudal=mean(samples.map(p=>p.milestones?.feudal));
  row.avgCastles=mean(samples.map(p=>p.milestones?.castles));
  row.avgImperial=mean(samples.map(p=>p.milestones?.imperial));
  row.avgStartScore=mean(samples.map(p=>p.start?.score));
  row.avgCombats=mean(samples.map(p=>p.combat?.fought));
  row.avgCombatWins=mean(samples.map(p=>p.combat?.wins));
  row.avgAttacks=mean(samples.map(p=>p.combat?.attacks));
  row.avgAttackWins=mean(samples.map(p=>p.combat?.attackWins));
  row.avgEliminatedRound=mean(samples.map(p=>p.eliminatedRound));
  row.avgProduced=mean(samples.map(p=>p.economy?.totalProduced));
  row.avgSpent=mean(samples.map(p=>p.economy?.totalSpent));
  row.avgFoodProduced=mean(samples.map(p=>p.economy?.produced?.food));
  row.avgWoodProduced=mean(samples.map(p=>p.economy?.produced?.wood));
  row.avgStoneProduced=mean(samples.map(p=>p.economy?.produced?.stone));
  row.avgGoldProduced=mean(samples.map(p=>p.economy?.produced?.gold));
}

export function summarizeGames(games,civs){
  const civSummary=emptyCivSummary(civs);
  const completedSamples=Object.fromEntries(civs.map(c=>[c,[]]));
  const statuses={};

  const seatSummary=Array.from({length:civs.length},(_,i)=>({
    seat:i+1,
    appearances:0,
    completedAppearances:0,
    incompleteAppearances:0,
    wins:0,
    losses:0,
    winRate:null,
    winRateCI95:null,
    avgStartScore:null
  }));
  const seatCompletedSamples=Array.from({length:civs.length},()=>[]);
  const seatCivSummary=Array.from({length:civs.length},(_,seat)=>
    Object.fromEntries(civs.map(civ=>[
      civ,
      {
        seat:seat+1,
        civ,
        completedAppearances:0,
        wins:0,
        winRate:null
      }
    ]))
  );

  const completedGames=games.filter(g=>g.status==='completed' && g.winnerId);
  const completedSet=new Set(completedGames);

  for(const game of games){
    statuses[game.status]=(statuses[game.status]||0)+1;
    const completed=completedSet.has(game);

    game.players.forEach((p,seat)=>{
      const row=civSummary[p.civ] || (civSummary[p.civ]={
        appearances:0,
        completedAppearances:0,
        incompleteAppearances:0,
        wins:0,
        losses:0,
        winRate:null,
        winRateCI95:null
      });

      row.appearances++;
      seatSummary[seat].appearances++;

      if(!completed){
        row.incompleteAppearances++;
        seatSummary[seat].incompleteAppearances++;
        return;
      }

      row.completedAppearances++;
      seatSummary[seat].completedAppearances++;
      completedSamples[p.civ].push(p);
      seatCompletedSamples[seat].push(p);

      const seatCiv=seatCivSummary[seat][p.civ] || (
        seatCivSummary[seat][p.civ]={
          seat:seat+1,
          civ:p.civ,
          completedAppearances:0,
          wins:0,
          winRate:null
        }
      );
      seatCiv.completedAppearances++;

      if(game.winnerId===p.id){
        row.wins++;
        seatSummary[seat].wins++;
        seatCiv.wins++;
      }
    });
  }

  for(const [civ,row] of Object.entries(civSummary)){
    row.losses=row.completedAppearances-row.wins;
    row.winRate=row.completedAppearances ? row.wins/row.completedAppearances : null;
    row.winRateCI95=wilsonInterval(row.wins,row.completedAppearances);
    aggregatePlayerMetrics(row,completedSamples[civ] || []);
  }

  for(const row of seatSummary){
    row.losses=row.completedAppearances-row.wins;
    row.winRate=row.completedAppearances ? row.wins/row.completedAppearances : null;
    row.winRateCI95=wilsonInterval(row.wins,row.completedAppearances);
    row.avgStartScore=mean(
      seatCompletedSamples[row.seat-1].map(p=>p.start?.score)
    );
  }

  for(const seat of seatCivSummary){
    for(const row of Object.values(seat)){
      row.winRate=row.completedAppearances
        ? row.wins/row.completedAppearances
        : null;
    }
  }

  return {
    games:games.length,
    completed:completedGames.length,
    incomplete:games.length-completedGames.length,
    completionRate:games.length ? completedGames.length/games.length : 0,
    statuses,
    avgRoundsCompleted:mean(completedGames.map(g=>g.rounds)),
    avgRoundsAll:mean(games.map(g=>g.rounds)),
    civs:civSummary,
    seatWins:seatSummary.map(x=>x.wins),
    seatSummary,
    seatCivSummary
  };
}

export function runBenchmark({
  seeds = BENCHMARK_SEEDS,
  civs = DEFAULT_CIVS,
  profiles = DEFAULT_PROFILES,
  maxRounds = 400,
  cuSelectionOrder = null
} = {}) {
  const games=[];

  for(const profile of profiles){
    seeds.forEach(seed=>{
      for(let seatRotation=0;seatRotation<civs.length;seatRotation++){
        const order=rotate(civs,seatRotation);

        const result=runFFAGame({
          civs:order,
          seed,
          botSeed:`benchmark:${profile}:${seed}`,
          profile,
          maxRounds,
          cuSelectionOrder
        });

        result.profile=profile;
        result.seatRotation=seatRotation;
        result.civOrder=[...order];
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
    schemaVersion:2,
    benchmarkVersion:'hito3-v1',
    revision:process.env.GITHUB_SHA || null,
    generatedAt:new Date().toISOString(),
    mapPreset:'ffa36',
    seeds:[...seeds],
    profiles:[...profiles],
    civOrderBase:[...civs],
    maxRounds,
    cuSelectionOrder:cuSelectionOrder ? [...cuSelectionOrder] : null,
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
    benchmarkVersion:result.benchmarkVersion,
    mapPreset:result.mapPreset,
    seeds:seedCount,
    profiles,
    games:result.games,
    completed:result.completed,
    incomplete:result.incomplete,
    completionRate:result.completionRate,
    statuses:result.statuses,
    civs:result.civs,
    seatSummary:result.seatSummary,
    byProfile:result.byProfile
  },null,2));
}
