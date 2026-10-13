import { readFileSync, writeFileSync } from 'node:fs';

function gameKey(game){
  return [
    game.profile,
    game.seed,
    game.seatRotation
  ].join('|');
}

function pct(v){
  return v==null ? null : v*100;
}

function summarizePaired(baseline,candidate){
  const a=new Map(baseline.results.map(g=>[gameKey(g),g]));
  const b=new Map(candidate.results.map(g=>[gameKey(g),g]));

  const keys=[...a.keys()].filter(k=>b.has(k)).sort();
  const pairs=keys.map(key=>({
    key,
    baseline:a.get(key),
    candidate:b.get(key)
  }));

  const bothCompleted=pairs.filter(
    x=>x.baseline.status==='completed' && x.candidate.status==='completed'
  );

  const civs=[...new Set([
    ...(baseline.civOrderBase||[]),
    ...(candidate.civOrderBase||[])
  ])];

  const civSummary=Object.fromEntries(civs.map(civ=>[
    civ,
    {
      civ,
      pairedGames:bothCompleted.length,
      baselineWins:0,
      candidateWins:0,
      gainedWins:0,
      lostWins:0,
      unchangedWins:0,
      baselineRate:0,
      candidateRate:0,
      delta:0
    }
  ]));

  const seatCount=Math.max(
    ...pairs.flatMap(x=>[
      x.baseline.players?.length||0,
      x.candidate.players?.length||0
    ]),
    0
  );

  const seatSummary=Array.from({length:seatCount},(_,i)=>({
    seat:i+1,
    pairedGames:bothCompleted.length,
    baselineWins:0,
    candidateWins:0,
    gainedWins:0,
    lostWins:0,
    baselineRate:0,
    candidateRate:0,
    delta:0
  }));

  const winnerChanges={};

  for(const pair of bothCompleted){
    const aw=pair.baseline.winnerCiv;
    const bw=pair.candidate.winnerCiv;
    const change=`${aw||'none'} -> ${bw||'none'}`;
    winnerChanges[change]=(winnerChanges[change]||0)+1;

    for(const civ of civs){
      const aWin=aw===civ;
      const bWin=bw===civ;
      const row=civSummary[civ];

      if(aWin) row.baselineWins++;
      if(bWin) row.candidateWins++;
      if(!aWin&&bWin) row.gainedWins++;
      if(aWin&&!bWin) row.lostWins++;
      if(aWin&&bWin) row.unchangedWins++;
    }

    const aSeat=pair.baseline.players?.findIndex(p=>p.id===pair.baseline.winnerId) ?? -1;
    const bSeat=pair.candidate.players?.findIndex(p=>p.id===pair.candidate.winnerId) ?? -1;

    for(let seat=0;seat<seatSummary.length;seat++){
      const row=seatSummary[seat];
      const aWin=aSeat===seat;
      const bWin=bSeat===seat;
      if(aWin) row.baselineWins++;
      if(bWin) row.candidateWins++;
      if(!aWin&&bWin) row.gainedWins++;
      if(aWin&&!bWin) row.lostWins++;
    }
  }

  for(const row of Object.values(civSummary)){
    row.baselineRate=bothCompleted.length ? row.baselineWins/bothCompleted.length : 0;
    row.candidateRate=bothCompleted.length ? row.candidateWins/bothCompleted.length : 0;
    row.delta=row.candidateRate-row.baselineRate;
  }

  for(const row of seatSummary){
    row.baselineRate=bothCompleted.length ? row.baselineWins/bothCompleted.length : 0;
    row.candidateRate=bothCompleted.length ? row.candidateWins/bothCompleted.length : 0;
    row.delta=row.candidateRate-row.baselineRate;
  }

  return {
    schemaVersion:1,
    comparisonVersion:'hito3-ab-v1',
    generatedAt:new Date().toISOString(),
    baseline:{
      revision:baseline.revision||null,
      benchmarkVersion:baseline.benchmarkVersion||null,
      mapPreset:baseline.mapPreset||null,
      games:baseline.games,
      completed:baseline.completed
    },
    candidate:{
      revision:candidate.revision||null,
      benchmarkVersion:candidate.benchmarkVersion||null,
      mapPreset:candidate.mapPreset||null,
      games:candidate.games,
      completed:candidate.completed
    },
    matchedPairs:pairs.length,
    bothCompleted:bothCompleted.length,
    baselineOnlyCompleted:pairs.filter(
      x=>x.baseline.status==='completed'&&x.candidate.status!=='completed'
    ).length,
    candidateOnlyCompleted:pairs.filter(
      x=>x.baseline.status!=='completed'&&x.candidate.status==='completed'
    ).length,
    civs:civSummary,
    seats:seatSummary,
    winnerChanges
  };
}

export function compareBenchmarks(baseline,candidate){
  if(!baseline?.results||!candidate?.results){
    throw new Error('Ambos benchmarks deben contener results.');
  }

  if(
    baseline.mapPreset &&
    candidate.mapPreset &&
    baseline.mapPreset!==candidate.mapPreset
  ){
    throw new Error(
      `No se pueden comparar presets distintos: ${baseline.mapPreset} vs ${candidate.mapPreset}.`
    );
  }

  return summarizePaired(baseline,candidate);
}

function report(result){
  const fmt=v=>`${v>=0?'+':''}${pct(v).toFixed(1)} pp`;
  const rate=v=>`${pct(v).toFixed(1)}%`;

  const lines=[
    '# AoE BoardGame — Hito 3 A/B Comparison',
    '',
    `- Matched game pairs: **${result.matchedPairs}**`,
    `- Completed in both: **${result.bothCompleted}**`,
    `- Baseline-only completed: **${result.baselineOnlyCompleted}**`,
    `- Candidate-only completed: **${result.candidateOnlyCompleted}**`,
    `- Baseline revision: **${result.baseline.revision||'unknown'}**`,
    `- Candidate revision: **${result.candidate.revision||'unknown'}**`,
    '',
    '> Win-rate deltas use only pairs completed by both versions.',
    '',
    '## Civilization deltas',
    '',
    '| Civilization | Baseline | Candidate | Delta | Gained wins | Lost wins |',
    '|---|---:|---:|---:|---:|---:|',
    ...Object.values(result.civs).map(row=>
      `| ${row.civ} | ${rate(row.baselineRate)} | ${rate(row.candidateRate)} | ${fmt(row.delta)} | ${row.gainedWins} | ${row.lostWins} |`
    ),
    '',
    '## Seat deltas',
    '',
    '| Seat | Baseline | Candidate | Delta | Gained wins | Lost wins |',
    '|---|---:|---:|---:|---:|---:|',
    ...result.seats.map(row=>
      `| P${row.seat} | ${rate(row.baselineRate)} | ${rate(row.candidateRate)} | ${fmt(row.delta)} | ${row.gainedWins} | ${row.lostWins} |`
    ),
    '',
    '## Winner transitions',
    '',
    ...Object.entries(result.winnerChanges)
      .sort((a,b)=>b[1]-a[1])
      .map(([change,n])=>`- ${change}: ${n}`)
  ];

  return lines.join('\n')+'\n';
}

const isDirect =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if(isDirect){
  const baselinePath=process.argv[2];
  const candidatePath=process.argv[3];

  if(!baselinePath||!candidatePath){
    throw new Error(
      'Uso: node compare-benchmarks.mjs baseline.json candidate.json [output-prefix]'
    );
  }

  const prefix=process.argv[4]||'benchmark-comparison';
  const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));
  const candidate=JSON.parse(readFileSync(candidatePath,'utf8'));
  const result=compareBenchmarks(baseline,candidate);

  writeFileSync(
    `${prefix}.json`,
    JSON.stringify(result,null,2)+'\n',
    'utf8'
  );

  const markdown=report(result);
  writeFileSync(`${prefix}.md`,markdown,'utf8');
  console.log(markdown);
}
