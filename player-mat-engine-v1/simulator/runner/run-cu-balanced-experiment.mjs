import { writeFileSync } from 'node:fs';
import { runFFAGame, DEFAULT_CIVS } from './simulate.js';
import {
  runBenchmark,
  summarizeGames,
  DEFAULT_PROFILES
} from './benchmark.mjs';
import { BENCHMARK_SEEDS } from './benchmark-seeds.js';
import { createRng, shuffle } from '../bots/rng.js';

const PLAYERS=['P1','P2','P3','P4'];

function rotate(values,n){
  const k=((n%values.length)+values.length)%values.length;
  return [...values.slice(k),...values.slice(0,k)];
}

export function balancedRandomCuOrders(key){
  const random=createRng(`hito3-cu-balanced:${key}`);
  const base=shuffle(PLAYERS,random);
  return PLAYERS.map((_,i)=>rotate(base,i));
}

function summarizePriority(games){
  const priorities=Array.from({length:4},(_,i)=>({
    priority:i+1,
    appearances:0,
    wins:0,
    winRate:null,
    avgStartScore:null
  }));
  const scoreSamples=Array.from({length:4},()=>[]);

  const seatPriority=Array.from({length:4},(_,seat)=>
    Array.from({length:4},(_,priority)=>({
      seat:seat+1,
      priority:priority+1,
      appearances:0,
      wins:0,
      winRate:null,
      avgStartScore:null
    }))
  );
  const seatPriorityScores=Array.from({length:4},()=>
    Array.from({length:4},()=>[])
  );

  const completed=games.filter(g=>g.status==='completed'&&g.winnerId);

  for(const game of completed){
    for(const player of game.players){
      const priority=player.start?.selectionIndex;
      if(!Number.isFinite(priority)||priority<1||priority>4) continue;

      const p=priorities[priority-1];
      p.appearances++;
      if(game.winnerId===player.id) p.wins++;
      if(Number.isFinite(player.start?.score)){
        scoreSamples[priority-1].push(player.start.score);
      }

      const seat=player.seat;
      if(Number.isFinite(seat)&&seat>=1&&seat<=4){
        const row=seatPriority[seat-1][priority-1];
        row.appearances++;
        if(game.winnerId===player.id) row.wins++;
        if(Number.isFinite(player.start?.score)){
          seatPriorityScores[seat-1][priority-1].push(player.start.score);
        }
      }
    }
  }

  for(const row of priorities){
    row.winRate=row.appearances?row.wins/row.appearances:null;
    const scores=scoreSamples[row.priority-1];
    row.avgStartScore=scores.length
      ? scores.reduce((a,b)=>a+b,0)/scores.length
      : null;
  }

  for(const seat of seatPriority){
    for(const row of seat){
      row.winRate=row.appearances?row.wins/row.appearances:null;
      const scores=seatPriorityScores[row.seat-1][row.priority-1];
      row.avgStartScore=scores.length
        ? scores.reduce((a,b)=>a+b,0)/scores.length
        : null;
    }
  }

  return { priorities, seatPriority };
}

export function runBalancedCuOrderExperiment({
  seeds=BENCHMARK_SEEDS.slice(0,10),
  civs=DEFAULT_CIVS,
  profiles=DEFAULT_PROFILES,
  maxRounds=400
}={}){
  const games=[];
  const orderUsage={};

  for(const profile of profiles){
    for(const seed of seeds){
      for(let seatRotation=0;seatRotation<civs.length;seatRotation++){
        const civOrder=rotate(civs,seatRotation);
        const orders=balancedRandomCuOrders(
          `${profile}:${seed}:${seatRotation}`
        );

        orders.forEach((cuSelectionOrder,cuOrderRotation)=>{
          const orderKey=cuSelectionOrder.join('>');
          orderUsage[orderKey]=(orderUsage[orderKey]||0)+1;

          const result=runFFAGame({
            civs:civOrder,
            seed,
            botSeed:`benchmark:${profile}:${seed}`,
            profile,
            maxRounds,
            cuSelectionOrder
          });

          result.profile=profile;
          result.seatRotation=seatRotation;
          result.civOrder=[...civOrder];
          result.cuOrderRotation=cuOrderRotation;
          result.experimentalCuOrder=[...cuSelectionOrder];
          games.push(result);
        });
      }
    }
  }

  const summary=summarizeGames(games,civs);
  const priority=summarizePriority(games);

  return {
    schemaVersion:1,
    experimentVersion:'hito3-cu-balanced-v1',
    revision:process.env.GITHUB_SHA||null,
    generatedAt:new Date().toISOString(),
    mapPreset:'ffa36',
    seeds:[...seeds],
    profiles:[...profiles],
    civOrderBase:[...civs],
    maxRounds,
    balancingRule:
      'Deterministic random base order plus four cyclic rotations per scenario',
    orderUsage,
    ...summary,
    ...priority,
    results:games
  };
}

function pct(v){
  return v==null?'—':`${(v*100).toFixed(1)}%`;
}

function fmt(v){
  return v==null?'—':Number(v).toFixed(1);
}

const isDirect=
  process.argv[1] &&
  import.meta.url===new URL(`file://${process.argv[1]}`).href;

if(isDirect){
  const count=Math.max(
    1,
    Math.min(BENCHMARK_SEEDS.length,Number(process.argv[2]||10))
  );
  const maxRounds=Math.max(50,Number(process.argv[3]||400));
  const seeds=BENCHMARK_SEEDS.slice(0,count);

  const reference=runBenchmark({
    seeds,
    maxRounds,
    cuSelectionOrder:PLAYERS
  });

  const balanced=runBalancedCuOrderExperiment({
    seeds,
    maxRounds
  });

  writeFileSync(
    'cu-balanced-reference.json',
    JSON.stringify(reference,null,2)+'\n',
    'utf8'
  );
  writeFileSync(
    'cu-balanced-results.json',
    JSON.stringify(balanced,null,2)+'\n',
    'utf8'
  );

  const referenceRange=
    Math.max(...reference.seatSummary.map(x=>x.winRate||0))-
    Math.min(...reference.seatSummary.map(x=>x.winRate||0));
  const balancedRange=
    Math.max(...balanced.seatSummary.map(x=>x.winRate||0))-
    Math.min(...balanced.seatSummary.map(x=>x.winRate||0));

  const lines=[
    '# Hito 3 — Experimento C: prioridad de CU desacoplada del asiento',
    '',
    `- Seeds: **${count}**`,
    '- Perfiles: **4**',
    '- Rotaciones de civilización: **4**',
    '- Órdenes balanceados de CU por escenario: **4**',
    `- Partidas referencia A: **${reference.games}**`,
    `- Partidas experimento C: **${balanced.games}**`,
    '',
    '## Finalización',
    '',
    `- A: **${reference.completed}/${reference.games}** (${pct(reference.completionRate)})`,
    `- C: **${balanced.completed}/${balanced.games}** (${pct(balanced.completionRate)})`,
    '',
    '## Resultado por asiento',
    '',
    '| Asiento | A win rate | C win rate | A start score | C start score |',
    '|---|---:|---:|---:|---:|',
    ...reference.seatSummary.map((a,i)=>{
      const c=balanced.seatSummary[i];
      return `| P${i+1} | ${pct(a.winRate)} | ${pct(c.winRate)} | ${fmt(a.avgStartScore)} | ${fmt(c.avgStartScore)} |`;
    }),
    '',
    `- Rango mejor-peor asiento A: **${(referenceRange*100).toFixed(1)} pp**`,
    `- Rango mejor-peor asiento C: **${(balancedRange*100).toFixed(1)} pp**`,
    '',
    '## Resultado por prioridad de elección de CU',
    '',
    '| Prioridad | Apariciones | Win rate | Start score |',
    '|---|---:|---:|---:|',
    ...balanced.priorities.map(row=>
      `| ${row.priority}º | ${row.appearances} | ${pct(row.winRate)} | ${fmt(row.avgStartScore)} |`
    ),
    '',
    '## Civilizaciones',
    '',
    '| Civilización | A | C |',
    '|---|---:|---:|',
    ...Object.keys(reference.civs).map(civ=>
      `| ${civ} | ${pct(reference.civs[civ].winRate)} | ${pct(balanced.civs[civ].winRate)} |`
    ),
    '',
    '## Control de balance de prioridad',
    '',
    '| Asiento | 1º | 2º | 3º | 4º |',
    '|---|---:|---:|---:|---:|',
    ...balanced.seatPriority.map((rows,seat)=>
      `| P${seat+1} | ${rows.map(r=>r.appearances).join(' | ')} |`
    ),
    '',
    '> En C el orden de turno continúa siendo P1 → P2 → P3 → P4. Sólo se desacopla la prioridad para elegir Centro Urbano. Cada asiento ocupa cada prioridad exactamente la misma cantidad de veces.'
  ];

  writeFileSync(
    'cu-balanced-summary.md',
    lines.join('\n')+'\n',
    'utf8'
  );

  console.log(lines.join('\n'));
}
