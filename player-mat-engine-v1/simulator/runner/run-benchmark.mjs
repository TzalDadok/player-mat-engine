import { writeFileSync } from 'node:fs';
import { runBenchmark } from './benchmark.mjs';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';

const count = Math.max(1, Math.min(
  BENCHMARK_SEEDS.length,
  Number(process.argv[2] || 10)
));
const maxRounds = Math.max(50, Number(process.argv[3] || 300));

const result = runBenchmark({
  seeds: BENCHMARK_SEEDS.slice(0, count),
  maxRounds
});

writeFileSync(
  'benchmark-results.json',
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);

const fmt = v => v == null ? '—' : Number(v).toFixed(1);

const lines = [
  '# AoE BoardGame — Fixed Balance Benchmark',
  '',
  `- Map seeds: **${count}**`,
  '- Seat rotations per map: **4**',
  `- Bot profiles: **${result.profiles.length}** (${result.profiles.join(', ')})`,
  `- Total games: **${result.games}**`,
  `- Completed: **${result.completed} / ${result.games}** (${(result.completionRate*100).toFixed(1)}%)`,
  `- Statuses: \`${JSON.stringify(result.statuses)}\``,
  '',
  '## Overall civilization results',
  '',
  '| Civilization | Apps | Wins | Win rate | 1st Barracks | 1st Military | 1st Combat | Avg military | Avg tech |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(result.civs).map(([civ,s]) =>
    `| ${civ} | ${s.appearances} | ${s.wins} | ${(s.winRate*100).toFixed(1)}% | ${fmt(s.avgFirstBarracks)} | ${fmt(s.avgFirstMilitary)} | ${fmt(s.avgFirstCombat)} | ${fmt(s.avgMilitaryTrained)} | ${fmt(s.avgTechnologies)} |`
  ),
  '',
  `Seat wins: ${result.seatWins.map((n,i)=>`P${i+1}=${n}`).join(', ')}`,
  ''
];

for (const profile of result.profiles) {
  const summary = result.byProfile[profile];

  lines.push(
    `## Profile: ${profile}`,
    '',
    `Completed: ${summary.completed}/${summary.games} (${(summary.completionRate*100).toFixed(1)}%)`,
    '',
    '| Civilization | Wins | Win rate | 1st Barracks | 1st Military | 1st Combat | Avg military | Avg tech |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...Object.entries(summary.civs).map(([civ,s]) =>
      `| ${civ} | ${s.wins} | ${(s.winRate*100).toFixed(1)}% | ${fmt(s.avgFirstBarracks)} | ${fmt(s.avgFirstMilitary)} | ${fmt(s.avgFirstCombat)} | ${fmt(s.avgMilitaryTrained)} | ${fmt(s.avgTechnologies)} |`
    ),
    '',
    `Seat wins: ${summary.seatWins.map((n,i)=>`P${i+1}=${n}`).join(', ')}`,
    ''
  );
}

writeFileSync(
  'benchmark-summary.md',
  lines.join('\n') + '\n',
  'utf8'
);

console.log(lines.join('\n'));
