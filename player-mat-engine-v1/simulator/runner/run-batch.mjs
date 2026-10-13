import { writeFileSync } from 'node:fs';
import { runBatch, printBatchSummary } from './batch.mjs';

const games = Math.max(1, Number(process.argv[2] || 100));
const seedPrefix = process.argv[3] || 'simulation';
const maxRounds = Math.max(20, Number(process.argv[4] || 250));

const summary = runBatch({ games, seedPrefix, maxRounds });
printBatchSummary(summary);

writeFileSync(
  'simulation-results.json',
  JSON.stringify(summary, null, 2) + '\n',
  'utf8'
);

const lines = [
  '# AoE BoardGame — Balance Simulation',
  '',
  `- Games: **${summary.config.games}**`,
  `- Completed: **${summary.completed} / ${summary.config.games}** (${(summary.completionRate*100).toFixed(1)}%)`,
  `- Average rounds (completed): **${summary.avgRounds.toFixed(1)}**`,
  `- Average combats (completed): **${summary.avgCombats.toFixed(1)}**`,
  '',
  '| Civilization | Wins | Win rate | Avg tech | Avg military | Avg villagers | Avg eliminations | Avg territories |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(summary.civs).map(([civ,s]) =>
    `| ${civ} | ${s.wins} | ${(s.winRate*100).toFixed(1)}% | ${s.avgTechnologies.toFixed(1)} | ${s.avgMilitaryTrained.toFixed(1)} | ${s.avgVillagersTrained.toFixed(1)} | ${s.avgEliminations.toFixed(2)} | ${s.avgControlledTerritories.toFixed(1)} |`
  )
];

writeFileSync('simulation-summary.md', lines.join('\n') + '\n', 'utf8');
