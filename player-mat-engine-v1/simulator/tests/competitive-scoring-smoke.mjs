import { AoEGame } from '../engine/game.js';

function ok(v,m){if(!v)throw new Error(m);}

function competitive(){
  return AoEGame.create({
    mode:'competitive',
    players:[
      {id:'P1',civ:'britanicos',name:'Britones'},
      {id:'P2',civ:'francos',name:'Francos'}
    ],
    radius:2
  });
}

// Comercio: requiere Mercado, Oro y suma a ambos.
{
  const g=competitive();
  const p1=g.playerMap.get('P1');
  const p2=g.playerMap.get('P2');
  const h1=g.hexMap.get(p1.tcHexId);
  const h2=g.hexMap.get(p2.tcHexId);
  g.addBuilding('P1','market',h1.id);
  g.addResourceTokens(h1.id,{wood:1});
  g.addResourceTokens(h2.id,{gold:1});
  g.state.phase='economy';

  g.trade('P1','P2',{
    give:{fromHexId:h1.id,toHexId:h2.id,resources:{wood:1}},
    receive:{fromHexId:h2.id,toHexId:h1.id,resources:{gold:1}}
  });

  ok(p1.stats.trades===1&&p2.stats.trades===1,'Un comercio debe contar para ambos.');
  ok(g.resourcesAt(h1.id).gold===1,'P1 debe recibir Oro.');
  ok(g.resourcesAt(h2.id).wood===1,'P2 debe recibir Madera.');
}

// Objetivos históricos + Maravilla transferible.
{
  const g=competitive();
  const p=g.playerMap.get('P1');
  p.stats.villagersTrained=8;
  p.stats.trades=5;
  p.technologies=Array.from({length:15},(_,i)=>'T'+i);
  p.age='imperial';
  p.stats.militaryTrained=15;
  p.stats.reached16MilitaryPower=true;
  p.stats.buildingsConstructed=Object.keys(g.civFor('P1').buildings);

  const wonder=g.state.hexes.find(h=>h.special==='wonder');
  const v=g.state.units.find(u=>u.ownerId==='P1');
  v.hexId=wonder.id;

  const score=g.competitiveScore('P1');
  ok(score.objectiveStars===8,'Debe tener las 8 estrellas de objetivos incluyendo Maravilla.');
  ok(score.objectivePoints===80,'Los 8 objetivos deben sumar 80 puntos.');

  v.hexId=p.tcHexId;
  const score2=g.competitiveScore('P1');
  ok(score2.objectiveStars===7,'Al perder Maravilla debe quedar en 7 estrellas.');
  ok(score2.objectivePoints===70,'Sin Maravilla los objetivos deben valer 70 puntos.');
}

// Territorios: primario +2, secundario +1; CU y Maravilla no.
{
  const g=competitive();
  const p=g.playerMap.get('P1');
  g.state.units=g.state.units.filter(u=>u.ownerId!=='P1');
  const primary=g.state.hexes.find(h=>h.source && !h.special);
  const secondary=g.state.hexes.find(h=>!h.source&&!h.special&&h.terrain!=='water');
  g.addUnit('P1','villager',primary.id);
  g.addUnit('P1','villager',secondary.id);

  const s=g.competitiveScore('P1');
  ok(s.primaryTerritories===1,'Debe contar 1 primario.');
  ok(s.secondaryTerritories===1,'Debe contar 1 secundario.');
  ok(s.territoryPoints===3,'1 primario + 1 secundario = 3 puntos.');
}

// Eliminación da estrella +10 al atacante y congela score del eliminado.
{
  const g=competitive();
  const before=g.competitiveScore('P2',{useFrozen:false});
  g.eliminatePlayer('P2','P1');

  ok(g.playerMap.get('P1').stats.eliminations===1,'Atacante debe registrar una eliminación.');
  const killer=g.competitiveScore('P1');
  ok(killer.eliminationStars===1&&killer.eliminationPoints===10,'Eliminación debe valer estrella + 10 puntos.');
  const frozen=g.competitiveScore('P2');
  ok(frozen.points===before.points,'El eliminado debe conservar su puntaje congelado.');
}

// Desempate: puntos, territorios y Poder Militar.
{
  const g=competitive();
  g.playerMap.get('P1').militaryPower=5;
  g.playerMap.get('P2').militaryPower=3;
  const rank=g.competitiveRankings();
  ok(rank[0].playerId==='P1','A igualdad de puntos/territorios debe ganar más Poder.');
}

console.log('Competitive scoring and trade tests: OK');
