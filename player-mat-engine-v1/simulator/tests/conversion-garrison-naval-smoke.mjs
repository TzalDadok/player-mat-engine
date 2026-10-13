import { AoEGame, RuleError } from '../engine/game.js';

function ok(v,m){ if(!v) throw new Error(m); }
function make(civ1='britanicos',civ2='francos'){
  return AoEGame.create({players:[
    {id:'P1',civ:civ1,name:'P1',militaryPower:10},
    {id:'P2',civ:civ2,name:'P2',militaryPower:10}
  ],radius:2});
}
function pair(g){
  for(const a of g.state.hexes){
    if(a.terrain==='water'||a.special) continue;
    for(const b of g.state.hexes){
      if(b.terrain==='water'||b.special) continue;
      const d=Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs((-a.q-a.r)-(-b.q-b.r)));
      if(d===1)return[a,b];
    }
  }
}

// Conversión: religioso ganador convierte un superviviente derrotado.
{
  const g=make('britanicos','francos');
  g.state.units=[]; g.state.phase='military';
  const [a,b]=pair(g);
  const mil1=g.addUnit('P1','militia',a.id);
  const mil2=g.addUnit('P1','militia',a.id);
  const mis=g.addUnit('P1','missionary',a.id);
  const d1=g.addUnit('P2','militia',b.id);
  const d2=g.addUnit('P2','militia',b.id);

  const r=g.attack('P1',{
    unitIds:[mil1.id,mil2.id,mis.id],
    targetHexId:b.id,
    loserCasualtyIds:[d1.id],
    convertedUnitIds:[d2.id]
  });

  ok(r.winnerId==='P1','Britones debe ganar.');
  ok(r.converted.includes(d2.id),'Debe registrar la conversión.');
  ok(g.state.units.find(u=>u.id===d2.id)?.ownerId==='P1','La unidad convertida debe cambiar de dueño.');
}

// Herejía: la unidad elegida muere en lugar de convertirse.
{
  const g=make('britanicos','francos');
  g.playerMap.get('P2').technologies.push('heresy');
  g.state.units=[]; g.state.phase='military';
  const [a,b]=pair(g);
  const m1=g.addUnit('P1','militia',a.id);
  const m2=g.addUnit('P1','militia',a.id);
  const mis=g.addUnit('P1','missionary',a.id);
  const d1=g.addUnit('P2','militia',b.id);
  const d2=g.addUnit('P2','militia',b.id);

  const r=g.attack('P1',{
    unitIds:[m1.id,m2.id,mis.id],
    targetHexId:b.id,
    loserCasualtyIds:[d1.id],
    convertedUnitIds:[d2.id]
  });

  ok(r.heresyKilled.includes(d2.id),'Herejía debe registrar muerte.');
  ok(!g.state.units.some(u=>u.id===d2.id),'La unidad protegida por Herejía debe morir.');
}

// Guarnición: requiere tecnología, arquería y Torre propia.
{
  const g=make('britanicos','francos');
  const p=g.playerMap.get('P1');
  const h=g.hexMap.get(p.tcHexId);
  const tower=g.addBuilding('P1','tower',h.id);
  const ar=g.addUnit('P1','archer',h.id);

  let failed=false;
  try{ g.garrisonUnit('P1',ar.id,tower.id); }catch(e){ failed=e instanceof RuleError; }
  ok(failed,'Sin Guarnición no debe poder guarecer.');

  p.technologies.push('garrison');
  g.garrisonUnit('P1',ar.id,tower.id);
  ok(ar.garrisonedIn===tower.id,'Arquero debe quedar guarecido.');
  ok(g.combatParticipants('P1',h.id,[]).some(u=>u.id===ar.id),'Guarecido debe seguir aportando al combate.');
}

// Transporte: embarca desde tierra adyacente y pasajeros siguen al barco.
{
  const g=make('britanicos','francos');
  g.state.units=[];
  const water=g.state.hexes.find(h=>h.terrain==='water');
  let land=g.state.hexes.find(h=>h.terrain!=='water' && Math.max(
    Math.abs(h.q-water.q),Math.abs(h.r-water.r),Math.abs((-h.q-h.r)-(-water.q-water.r))
  )===1);
  if(!land){
    water.terrain='water';
    land=g.state.hexes.find(h=>h.id!==water.id && h.terrain!=='water');
    land.q=water.q+1; land.r=water.r;
  }
  const ship=g.addUnit('P1','transportShip',water.id);
  const mil=g.addUnit('P1','militia',land.id);
  g.embarkUnits('P1',ship.id,[mil.id]);
  ok(mil.embarkedIn===ship.id,'Unidad debe quedar embarcada.');

  const water2=g.state.hexes.find(h=>h.id!==water.id && h.terrain==='water');
  if(water2){
    // La red naval modelada puede no conectar dos aguas de la misma vía; fijar vía distinta.
    water.waterLane='A'; water2.waterLane='B';
    g.state.phase='economy';
    g.moveUnits('P1',[ship.id],water2.id);
    ok(mil.hexId===water2.id,'Pasajero debe acompañar al barco.');
  }
}

// Religiosos enemigos coincidentes regresan a sus CU.
{
  const g=make('britanicos','francos');
  const h=pair(g)[0];
  const r1=g.addUnit('P1','missionary',h.id);
  const r2=g.addUnit('P2','monk',h.id);
  const returned=g.resolveReligiousEncounterAtHex(h.id);
  ok(returned.includes(r1.id)&&returned.includes(r2.id),'Ambos religiosos deben regresar.');
  ok(r1.hexId===g.playerMap.get('P1').tcHexId,'Misionero debe volver a CU.');
  ok(r2.hexId===g.playerMap.get('P2').tcHexId,'Monje debe volver a CU.');
}

console.log('Conversion garrison naval tests: OK');
