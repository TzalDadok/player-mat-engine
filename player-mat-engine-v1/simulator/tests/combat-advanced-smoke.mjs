import { AoEGame } from '../engine/game.js';

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

function create(civ1, civ2) {
  return AoEGame.create({
    players: [
      { id: 'P1', civ: civ1, name: civ1, militaryPower: 10 },
      { id: 'P2', civ: civ2, name: civ2, militaryPower: 10 }
    ],
    radius: 2
  });
}

function adjacentLandPair(g) {
  for (const a of g.state.hexes) {
    if (a.terrain === 'water' || a.special) continue;
    for (const b of g.state.hexes) {
      if (b.terrain === 'water' || b.special) continue;
      const d = Math.max(
        Math.abs(a.q - b.q),
        Math.abs(a.r - b.r),
        Math.abs((-a.q-a.r)-(-b.q-b.r))
      );
      if (d === 1) return [a,b];
    }
  }
  throw new Error('No adjacent pair');
}

// Piquero franco vs Caballería: bonus por pareja.
{
  const g=create('francos','persas');
  g.state.units=[];
  const [a,b]=adjacentLandPair(g);
  const s1=g.addUnit('P1','spearman',a.id);
  const s2=g.addUnit('P1','spearman',a.id);
  g.addUnit('P2','rider',b.id);
  const p1=g.combatParticipants('P1',b.id,[s1.id,s2.id]);
  const p2=g.combatParticipants('P2',b.id,[]);
  const x=g.combatForceBreakdown('P1',p1,p2,b.id,{role:'attacker',directIds:[s1.id,s2.id]});
  ok(x.base===2,'Dos Piqueros deben aportar Fuerza base 2.');
  ok(x.pairBonuses===1,'Sólo una pareja Piquero/Caballería debe otorgar +1.');
  ok(x.total===3,'Fuerza total franca esperada: 3.');
}

// Guerrero Vikingo: 2+ Milicias = +1 total.
{
  const g=create('vikingos','francos');
  g.playerMap.get('P1').technologies.push('viking_warrior');
  g.state.units=[];
  const [a,b]=adjacentLandPair(g);
  const m1=g.addUnit('P1','militia',a.id);
  const m2=g.addUnit('P1','militia',a.id);
  g.addUnit('P2','militia',b.id);
  const p1=g.combatParticipants('P1',b.id,[m1.id,m2.id]);
  const p2=g.combatParticipants('P2',b.id,[]);
  const x=g.combatForceBreakdown('P1',p1,p2,b.id,{role:'attacker',directIds:[m1.id,m2.id]});
  ok(x.base===4,'Dos Milicias Vikingas deben aportar base 4.');
  ok(x.contextual===1,'Guerrero Vikingo debe sumar +1 total.');
}

// Mahouts: Elefante + unidad a pie = +1 total.
{
  const g=create('persas','francos');
  g.playerMap.get('P1').technologies.push('mahouts');
  g.state.units=[];
  const [a,b]=adjacentLandPair(g);
  const e=g.addUnit('P1','elephant',a.id);
  const ar=g.addUnit('P1','archer',a.id);
  g.addUnit('P2','militia',b.id);
  const p1=g.combatParticipants('P1',b.id,[e.id,ar.id]);
  const p2=g.combatParticipants('P2',b.id,[]);
  const x=g.combatForceBreakdown('P1',p1,p2,b.id,{role:'attacker',directIds:[e.id,ar.id]});
  ok(x.contextual===1,'Mahouts debe sumar +1 con Elefante + unidad a pie.');
}

// Castillo: +1 a batalla a un hexágono.
{
  const g=create('britanicos','francos');
  g.state.units=[];
  const [a,b]=adjacentLandPair(g);
  const c=g.addBuilding('P1','castle',a.id);
  const mil=g.addUnit('P1','militia',a.id);
  g.addUnit('P2','militia',b.id);
  const p1=g.combatParticipants('P1',b.id,[mil.id]);
  const p2=g.combatParticipants('P2',b.id,[]);
  const x=g.combatForceBreakdown('P1',p1,p2,b.id,{role:'attacker',directIds:[mil.id]});
  ok(c && x.buildingSupport===1,'Castillo debe aportar +1 a distancia 1.');
}

// Berserkergang eleva el máximo apostable a 8 con 3+ Milicias atacando.
{
  const g=create('vikingos','francos');
  g.playerMap.get('P1').technologies.push('berserkergang');
  g.state.units=[];
  const [a,b]=adjacentLandPair(g);
  const units=[g.addUnit('P1','militia',a.id),g.addUnit('P1','militia',a.id),g.addUnit('P1','militia',a.id)];
  const max=g.maxBidFor('P1',{role:'attacker',participants:units,targetHexId:b.id});
  ok(max===8,'Berserkergang debe permitir apostar hasta 8.');
}

// Jefes Guerreros: al ganar recupera 1 de lo apostado.
{
  const g=create('vikingos','francos');
  g.playerMap.get('P1').technologies.push('warlords');
  g.state.units=[];
  g.state.phase='military';
  const [a,b]=adjacentLandPair(g);
  const m1=g.addUnit('P1','militia',a.id);
  const m2=g.addUnit('P1','militia',a.id);
  g.addUnit('P2','militia',b.id);
  const before=g.playerMap.get('P1').militaryPower;
  const result=g.attack('P1',{unitIds:[m1.id,m2.id],targetHexId:b.id,attackerBid:2,defenderBid:0});
  ok(result.winnerId==='P1','Vikingos debe ganar 4+2 contra 2.');
  ok(g.playerMap.get('P1').militaryPower===before-1,'Debe gastar 2 y recuperar 1 Poder.');
  ok(result.attackerBreakdown && typeof result.attackerBreakdown.total==='number','El combate debe devolver desglose de Fuerza.');
}

console.log('Advanced combat tests: OK');
