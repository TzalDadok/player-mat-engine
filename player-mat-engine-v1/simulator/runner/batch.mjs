import { runFFAGame, DEFAULT_CIVS } from './simulate.js';

function rotate(values, n) {
  const k = ((n % values.length) + values.length) % values.length;
  return [...values.slice(k), ...values.slice(0, k)];
}

function mean(values) {
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
}

export function runBatch({
  games = 100,
  civs = DEFAULT_CIVS,
  seedPrefix = 'batch',
  maxRounds = 250,
  aggression = 0.7,
  maxVillagers = 4
} = {}) {
  const rows = [];

  for (let i = 0; i < games; i++) {
    const seats = rotate(civs, i);
    const row = runFFAGame({
      civs: seats,
      seed: `${seedPrefix}-${i+1}`,
      botSeed: `${seedPrefix}:bot`,
      maxRounds,
      aggression,
      maxVillagers
    });
    rows.push(row);
  }

  const civSummary = Object.fromEntries(civs.map(civ => [civ, {
    games:0,
    wins:0,
    winRate:0,
    avgFinishRound:0,
    avgTechnologies:0,
    avgMilitaryTrained:0,
    avgVillagersTrained:0,
    avgEliminations:0,
    avgControlledTerritories:0
  }]));

  for (const row of rows) {
    for (const p of row.players) {
      const s = civSummary[p.civ] || (civSummary[p.civ] = {
        games:0,wins:0,winRate:0,avgFinishRound:0,avgTechnologies:0,
        avgMilitaryTrained:0,avgVillagersTrained:0,avgEliminations:0,
        avgControlledTerritories:0
      });
      s.games++;
      if (row.winnerCiv === p.civ) s.wins++;
    }
  }

  for (const [civ, s] of Object.entries(civSummary)) {
    const samples = rows.flatMap(row => row.players.filter(p => p.civ === civ).map(p => ({row,p})));
    s.winRate = s.games ? s.wins / s.games : 0;
    s.avgFinishRound = mean(samples.map(x => x.row.rounds));
    s.avgTechnologies = mean(samples.map(x => x.p.technologies));
    s.avgMilitaryTrained = mean(samples.map(x => x.p.militaryTrained));
    s.avgVillagersTrained = mean(samples.map(x => x.p.villagersTrained));
    s.avgEliminations = mean(samples.map(x => x.p.eliminations));
    s.avgControlledTerritories = mean(samples.map(x => x.p.controlledTerritories));
  }

  const completed = rows.filter(r => r.status === 'completed');
  const statusCounts = {};
  const stallCategories = {};
  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    for (const [category, count] of Object.entries(row.stall?.categories || {})) {
      stallCategories[category] = (stallCategories[category] || 0) + count;
    }
  }

  return {
    config:{games,civs:[...civs],seedPrefix,maxRounds,aggression,maxVillagers},
    completed:completed.length,
    completionRate:games ? completed.length/games : 0,
    avgRounds:mean(completed.map(r => r.rounds)),
    avgCombats:mean(completed.map(r => r.combats)),
    statusCounts,
    stallCategories,
    civs:civSummary,
    games:rows
  };
}

function formatPct(v){ return `${(v*100).toFixed(1)}%`; }

export function printBatchSummary(summary) {
  console.log(`Games: ${summary.config.games}`);
  console.log(`Completed: ${summary.completed} (${formatPct(summary.completionRate)})`);
  console.log(`Avg rounds: ${summary.avgRounds.toFixed(1)}`);
  console.log(`Avg combats: ${summary.avgCombats.toFixed(1)}`);
  console.log(`Statuses: ${JSON.stringify(summary.statusCounts)}`);
  console.log(`Stalls: ${JSON.stringify(summary.stallCategories)}`);
  console.log('');
  console.log('Civilization summary');
  for (const [civ, s] of Object.entries(summary.civs)) {
    console.log(
      `${civ.padEnd(12)} wins=${String(s.wins).padStart(3)} ` +
      `rate=${formatPct(s.winRate).padStart(6)} ` +
      `tech=${s.avgTechnologies.toFixed(1)} ` +
      `mil=${s.avgMilitaryTrained.toFixed(1)} ` +
      `vill=${s.avgVillagersTrained.toFixed(1)} ` +
      `elim=${s.avgEliminations.toFixed(2)} ` +
      `terr=${s.avgControlledTerritories.toFixed(1)}`
    );
  }
}

const isDirect = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isDirect) {
  const games = Math.max(1, Number(process.argv[2] || 100));
  const seedPrefix = process.argv[3] || 'cli';
  const summary = runBatch({ games, seedPrefix });
  printBatchSummary(summary);
}
