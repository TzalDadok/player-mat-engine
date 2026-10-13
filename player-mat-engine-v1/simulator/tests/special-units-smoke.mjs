import { AoEGame, RuleError } from '../engine/game.js';

function ok(c,m){ if(!c) throw new Error(m); }
function make(){
  return AoEGame.create({
    players:[
      {id:'P1',civ:'francos',name:'Francos'},
      {id:'P2',civ:'francos',name:'Francos 2'}
    ],
    radius:2
  });
}
function pair(g){
  for(const a of g.state.hexes){
    if(a.terrain==='water'||a.special) continue;
    for(const b of g.state.hexes){
      if(b.terrain==='water'||b.special) continue;
      const d=Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs((-a.q-a.r)-(-b.q-b.r)));
      if(d===1) return [a,b];
    }
  }
}

// Asedio no se mueve solo, pero sí acompañado.
{
  const g=make();
  g.state.units=[];
  g.state.phase='military';
  const [a,b]=pair(g);
  const sc=g.addUnit('P1','scorpion',a.id);

  let failed=false;
  try { g.moveUnits('P1',[sc.id],b.id); } catch(err){ failed=err instanceof RuleError; }
  ok(failed,'Escorpión no debe poder moverse solo.');

  g.state.actionUsed=false;
  sc.hexId=a.id;
  const mil=g.addUnit('P1','militia',a.id);
  g.moveUnits('P1',[sc.id,mil.id],b.id);
  ok(sc.hexId===b.id && mil.hexId===b.id,'Asedio debe poder viajar acompañado.');
}

// Asedio necesita Aldeano en su hexágono para participar en combate.
{
  const g=make();
  g.state.units=[];
  const [a,b]=pair(g);
  const sc=g.addUnit('P1','scorpion',a.id);
  g.addUnit('P2','militia',b.id);

  let parts=g.combatParticipants('P1',b.id,[]);
  ok(!parts.some(u=>u.id===sc.id),'Asedio sin Aldeano operador no debe participar.');

  g.addUnit('P1','villager',a.id);
  parts=g.combatParticipants('P1',b.id,[]);
  ok(parts.some(u=>u.id===sc.id),'Asedio con Aldeano operador debe participar.');
}

// Religioso superviviente rescata una baja tras perder.
{
  const g=make();
  g.state.units=[];
  g.state.phase='military';
  const [a,b]=pair(g);

  const a1=g.addUnit('P1','militia',a.id);
  const a2=g.addUnit('P1','militia',a.id);
  const a3=g.addUnit('P1','militia',a.id);

  const d1=g.addUnit('P2','militia',b.id);
  const d2=g.addUnit('P2','militia',b.id);
  const monk=g.addUnit('P2','monk',b.id);

  const result=g.attack('P1',{
    unitIds:[a1.id,a2.id,a3.id],
    targetHexId:b.id,
    loserCasualtyIds:[d1.id,d2.id]
  });

  ok(result.winnerId==='P1','Atacante debe ganar 6 contra 4.');
  ok(result.initialCasualties.length===2,'La diferencia 2 debe generar 2 bajas iniciales.');
  ok(result.rescuedByReligious.length===1,'Monje superviviente debe rescatar 1 baja.');
  ok(result.casualties.length===1,'Debe quedar 1 baja efectiva.');
  ok(g.state.units.some(u=>u.id===monk.id),'El Monje superviviente debe seguir en juego.');
}

console.log('Siege and religious healing tests: OK');
