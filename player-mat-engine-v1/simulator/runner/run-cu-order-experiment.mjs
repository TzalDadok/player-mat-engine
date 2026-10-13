import { writeFileSync } from 'node:fs';
import { runBenchmark } from './benchmark.mjs';
import { compareBenchmarks } from './compare-benchmarks.mjs';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';

const count=Math.max(
  1,
  Math.min(BENCHMARK_SEEDS.length,Number(process.argv[2]||10))
);
const maxRounds=Math.max(50,Number(process.argv[3]||400));
const seeds=BENCHMARK_SEEDS.slice(0,count);

const ORDER_A=['P1','P2','P3','P4'];
const ORDER_B=['P4','P3','P2','P1'];

const common={
  seeds,
  maxRounds
};

const baseline=runBenchmark({
  ...common,
  cuSelectionOrder:ORDER_A
});

const reversed=runBenchmark({
  ...common,
  cuSelectionOrder:ORDER_B
});

const comparison=compareBenchmarks(baseline,reversed);

writeFileSync(
  'cu-order-a-results.json',
  JSON.stringify(baseline,null,2)+'\n',
  'utf8'
);
writeFileSync(
  'cu-order-b-results.json',
  JSON.stringify(reversed,null,2)+'\n',
  'utf8'
);
writeFileSync(
  'cu-order-comparison.json',
  JSON.stringify(comparison,null,2)+'\n',
  'utf8'
);

const pct=v=>v==null?'—':`${(v*100).toFixed(1)}%`;
const fmt=v=>v==null?'—':Number(v).toFixed(1);

const lines=[
  '# Hito 3 — Experimento B: orden inverso de elección de CU',
  '',
  `- Seeds: **${count}**`,
  '- Rotaciones por seed: **4**',
  '- Perfiles: **4**',
  `- Partidas por variante: **${baseline.games}**`,
  `- A: **${ORDER_A.join(' → ')}**`,
  `- B: **${ORDER_B.join(' → ')}**`,
  '',
  '## Finalización',
  '',
  `- A: **${baseline.completed}/${baseline.games}** (${pct(baseline.completionRate)})`,
  `- B: **${reversed.completed}/${reversed.games}** (${pct(reversed.completionRate)})`,
  '',
  '## Resultado por asiento',
  '',
  '| Asiento | A win rate | B win rate | A start score | B start score |',
  '|---|---:|---:|---:|---:|',
  ...baseline.seatSummary.map((a,i)=>{
    const b=reversed.seatSummary[i];
    return `| P${i+1} | ${pct(a.winRate)} | ${pct(b.winRate)} | ${fmt(a.avgStartScore)} | ${fmt(b.avgStartScore)} |`;
  }),
  '',
  '## Resultado por civilización',
  '',
  '| Civilización | A | B | Cambio |',
  '|---|---:|---:|---:|',
  ...Object.keys(baseline.civs).map(civ=>{
    const a=baseline.civs[civ].winRate;
    const b=reversed.civs[civ].winRate;
    const delta=(b??0)-(a??0);
    return `| ${civ} | ${pct(a)} | ${pct(b)} | ${delta>=0?'+':''}${(delta*100).toFixed(1)} pp |`;
  }),
  '',
  '## A/B pareado',
  '',
  `- Pares emparejados: **${comparison.matchedPairs}**`,
  `- Completados en ambas variantes: **${comparison.bothCompleted}**`,
  '',
  '> La única variable entre A y B es el orden de selección de Centro Urbano. El orden de turnos, la construcción del mapa, las civilizaciones, seeds, perfiles y rotaciones permanecen iguales.'
];

writeFileSync(
  'cu-order-experiment-summary.md',
  lines.join('\n')+'\n',
  'utf8'
);

console.log(lines.join('\n'));
