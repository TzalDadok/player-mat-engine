import { writeFileSync } from 'node:fs';
import { runBenchmark } from './benchmark.mjs';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';

const count=Math.max(1,Math.min(
  BENCHMARK_SEEDS.length,
  Number(process.argv[2]||10)
));
const maxRounds=Math.max(50,Number(process.argv[3]||400));

const result=runBenchmark({
  seeds:BENCHMARK_SEEDS.slice(0,count),
  maxRounds
});

writeFileSync(
  'benchmark-results.json',
  JSON.stringify(result,null,2)+'\n',
  'utf8'
);

const fmt=v=>v==null?'—':Number(v).toFixed(1);
const pct=v=>v==null?'—':`${(v*100).toFixed(1)}%`;
const ci=range=>range
  ? `${(range.low*100).toFixed(1)}–${(range.high*100).toFixed(1)}%`
  : '—';

const lines=[
  '# AoE BoardGame — Hito 3 Fixed Balance Benchmark',
  '',
  `- Benchmark version: **${result.benchmarkVersion}**`,
  `- Map preset: **${result.mapPreset}**`,
  `- Revision: **${result.revision || 'local'}**`,
  `- Map seeds: **${count}**`,
  '- Seat rotations per map: **4**',
  `- Bot profiles: **${result.profiles.length}** (${result.profiles.join(', ')})`,
  `- Total games: **${result.games}**`,
  `- Completed: **${result.completed} / ${result.games}** (${pct(result.completionRate)})`,
  `- Incomplete: **${result.incomplete}**`,
  `- Statuses: \`${JSON.stringify(result.statuses)}\``,
  `- Avg rounds (completed): **${fmt(result.avgRoundsCompleted)}**`,
  '',
  '> Win rates and confidence intervals use only completed games. Incomplete games are reported separately and are not counted as losses.',
  '',
  '## Overall civilization results',
  '',
  '| Civilization | Completed apps | Wins | Win rate | 95% CI | Start score | Produced | Spent | 1st Barracks | 1st Military | 1st Combat | Combats | Combat wins |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(result.civs).map(([civ,s])=>
    `| ${civ} | ${s.completedAppearances} | ${s.wins} | ${pct(s.winRate)} | ${ci(s.winRateCI95)} | ${fmt(s.avgStartScore)} | ${fmt(s.avgProduced)} | ${fmt(s.avgSpent)} | ${fmt(s.avgFirstBarracks)} | ${fmt(s.avgFirstMilitary)} | ${fmt(s.avgFirstCombat)} | ${fmt(s.avgCombats)} | ${fmt(s.avgCombatWins)} |`
  ),
  '',
  '## Seat results',
  '',
  '| Seat | Completed apps | Wins | Win rate | 95% CI | Avg start score |',
  '|---|---:|---:|---:|---:|---:|',
  ...result.seatSummary.map(s=>
    `| P${s.seat} | ${s.completedAppearances} | ${s.wins} | ${pct(s.winRate)} | ${ci(s.winRateCI95)} | ${fmt(s.avgStartScore)} |`
  ),
  '',
  '## Civilization × seat win rates',
  '',
  '| Seat | '+result.civOrderBase.map(c=>c).join(' | ')+' |',
  '|---|'+result.civOrderBase.map(()=> '---:').join('|')+'|',
  ...result.seatCivSummary.map((seat,idx)=>
    `| P${idx+1} | ${result.civOrderBase.map(civ=>{
      const row=seat[civ];
      return row ? `${pct(row.winRate)} (${row.wins}/${row.completedAppearances})` : '—';
    }).join(' | ')} |`
  ),
  ''
];

for(const profile of result.profiles){
  const summary=result.byProfile[profile];

  lines.push(
    `## Profile: ${profile}`,
    '',
    `Completed: ${summary.completed}/${summary.games} (${pct(summary.completionRate)})`,
    '',
    '| Civilization | Completed apps | Wins | Win rate | 95% CI | Produced | Spent | 1st Military | 1st Combat | Avg military | Avg tech |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...Object.entries(summary.civs).map(([civ,s])=>
      `| ${civ} | ${s.completedAppearances} | ${s.wins} | ${pct(s.winRate)} | ${ci(s.winRateCI95)} | ${fmt(s.avgProduced)} | ${fmt(s.avgSpent)} | ${fmt(s.avgFirstMilitary)} | ${fmt(s.avgFirstCombat)} | ${fmt(s.avgMilitaryTrained)} | ${fmt(s.avgTechnologies)} |`
    ),
    '',
    'Seat win rates: '+summary.seatSummary.map(s=>`P${s.seat}=${pct(s.winRate)}`).join(', '),
    ''
  );
}

writeFileSync(
  'benchmark-summary.md',
  lines.join('\n')+'\n',
  'utf8'
);

console.log(lines.join('\n'));
