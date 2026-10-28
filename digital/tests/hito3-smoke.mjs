import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const port=8794;
const origin='http://127.0.0.1:'+port;
const base='ws://127.0.0.1:'+port+'/ws/';
const runner=spawn(process.execPath,['./node_modules/wrangler/bin/wrangler.js','dev','--local','--port',String(port),'--ip','127.0.0.1'],{
  cwd:process.cwd(),env:{...process.env,NO_COLOR:'1',CI:'1'},stdio:['ignore','pipe','pipe']
});
let output='';
for(const stream of [runner.stdout,runner.stderr])stream.on('data',buf=>{output+=String(buf);if(output.length>8000)output=output.slice(-8000)});
const delay=(ms)=>new Promise(ok=>setTimeout(ok,ms));
async function ready(){
  for(let n=0;n<75;n++){
    if(runner.exitCode!==null)throw Error('Wrangler terminó inesperadamente: '+output);
    try{const response=await fetch(origin+'/api/health');if(response.ok)return}catch{}
    await delay(400);
  }
  throw Error('El servidor no empezó: '+output);
}
function player(name,room,token=randomUUID()){
  const ws=new WebSocket(base+room+'?name='+encodeURIComponent(name)+'&token='+token);
  const history=[];
  let wake=[];
  ws.addEventListener('message',e=>{
    try{history.push(JSON.parse(String(e.data)))}catch{}
    for(const fn of wake)fn();
    wake=[];
  });
  const open=new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  return {ws,open,token,send:data=>ws.send(JSON.stringify(data)),history,
    async wait(test,ms=12000){
      const started=Date.now();
      while(Date.now()-started<ms){
        const found=history.find(test);
        if(found)return found;
        await new Promise(resolve=>{const timeout=setTimeout(resolve,80);wake.push(()=>{clearTimeout(timeout);resolve()})});
      }
      throw Error('Timeout esperando mensaje. Vistos: '+JSON.stringify(history.slice(-6)));
    },
    close:()=>ws.close()
  };
}
const directions=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function chooseCU(map){
  const occupied=new Set([...map.hexes,{q:0,r:0}].map(p=>p.q+','+p.r));
  const candidates=new Map();
  for(const hex of map.hexes)for(const [dq,dr] of directions){
    const pos={q:hex.q+dq,r:hex.r+dr};
    const id=pos.q+','+pos.r;
    if(!occupied.has(id))candidates.set(id,pos);
  }
  const options=[...candidates.values()].filter(p=>(map.centers||[]).every(c=>distance(p,c)>1)&&map.hexes.some(h=>distance(p,h)===1&&!h.type.startsWith('Agua')));
  assert(options.length,'No hay posición exterior válida');
  // Priorizar un CU que permita producir desde el primer turno.
  options.sort((a,b)=>{
    const score=p=>map.hexes.filter(h=>distance(p,h)===1&&['Bosque','Animales','Frutos silvestres','Cantera de Oro','Cantera de Piedra'].includes(h.type)).length;
    return score(b)-score(a);
  });
  return options[0];
}
async function play(count){
  const room='CI-'+randomUUID().slice(0,8);
  const clients=[];
  try{
    for(let i=0;i<count;i++){
      const p=player('Jugador '+(i+1),room);clients.push(p);
      await p.open;await p.wait(m=>m.type==='welcome');
    }
    const host=clients[0];
    host.send({type:'generate',count});
    const first=await host.wait(m=>m.type==='map'&&m.map?.count===count);
    assert.equal(first.map.hexes.length,count===2?18:36);
    for(let i=0;i<count;i++){
      clients[i].send({type:'choose_civ',civ:i});
      await host.wait(m=>m.type==='map'&&m.map?.civs?.[i]===i);
    }
    // El servidor rechaza elegir civilización repetida.
    clients[1].send({type:'choose_civ',civ:0});
    await clients[1].wait(m=>m.type==='error'&&m.message.includes('ya está elegida'));
    host.send({type:'start_game'});
    await host.wait(m=>m.type==='error'&&m.message.includes('Ready'));
    for(let i=0;i<count;i++){
      clients[i].send({type:'set_ready',ready:true});
      await host.wait(m=>m.type==='map'&&m.map?.ready?.[i]===true);
    }
    host.send({type:'start_game'});
    let state=(await host.wait(m=>m.type==='map'&&m.map?.started===true)).map;
    for(let i=0;i<count;i++){
      const seat=state.order[state.centers.length];
      const target=chooseCU(state);
      clients[seat].send({type:'place_cu',q:target.q,r:target.r});
      state=(await host.wait(m=>m.type==='map'&&m.map?.draft?.seat===seat&&m.map.draft.q===target.q&&m.map.draft.r===target.r)).map;
      clients[seat].send({type:'confirm_cu'});
      state=(await host.wait(m=>m.type==='map'&&m.map?.centers?.length===i+1)).map;
    }
    assert(state.match,'No empezó el motor de turnos tras colocar los CU');
    assert.equal(state.match.round,1);
    assert.equal(state.match.turn,0);
    assert.equal(state.match.phase,0);
    assert.equal(Object.keys(state.match.players).length,count);
    if(count===4){
      assert.deepEqual(state.order.map(s=>state.match.units.filter(u=>u.seat===s).length),[1,1,2,2]);
      assert.deepEqual(state.order.map(s=>state.match.players[s].pm),[1,0,0,1]);
    }
    // Un jugador que no tiene el turno no puede ejecutar acciones.
    clients[1].send({type:'game_action',action:'pass'});
    await clients[1].wait(m=>m.type==='error'&&m.message.includes('No es tu turno'));
    const activeSeat=state.order[0];
    clients[activeSeat].send({type:'game_action',action:'trade',kind:'food',side:'buy',amount:2});
    await clients[activeSeat].wait(m=>m.type==='error'&&m.message.includes('oro suficiente'));
    const unit=state.match.units.find(u=>u.seat===activeSeat&&!state.match.units.some(other=>other.seat!==activeSeat&&other.q===u.q&&other.r===u.r)&&state.hexes.some(h=>h.q===u.q&&h.r===u.r&&['Bosque','Animales','Frutos silvestres','Cantera de Oro','Cantera de Piedra'].includes(h.type)));
    if(unit){
      clients[activeSeat].send({type:'game_action',action:'produce',hexes:[{q:unit.q,r:unit.r}]});
      state=(await host.wait(m=>m.type==='map'&&m.map?.match?.phase===1)).map;
      assert(Object.values(state.match.players[activeSeat].resources).some(v=>v>0),'Producción no sumó recursos');
      const stock=state.match.stock[unit.q+','+unit.r];
      assert(stock&&Object.values(stock).some(value=>value>0),'Producción no quedó almacenada en su hexágono');
    }else{
      clients[activeSeat].send({type:'game_action',action:'pass'});
      state=(await host.wait(m=>m.type==='map'&&m.map?.match?.phase===1)).map;
    }
    // Las dos unidades pueden tener orígenes y destinos diferentes.
    // En la ronda siguiente se prueba el movimiento sin exigir mismo origen.
    clients[activeSeat].send({type:'game_action',action:'pass'});
    state=(await host.wait(m=>m.type==='map'&&m.map?.match?.phase===2)).map;
    clients[activeSeat].send({type:'game_action',action:'pass'});
    state=(await host.wait(m=>m.type==='map'&&m.map?.match?.turn===1)).map;
    // Recuperar el puesto usando su código privado, reemplazando socket viejo.
    const rejoined=player('Reingreso',room,clients[0].token);
    await rejoined.open;
    const welcome=await rejoined.wait(m=>m.type==='welcome');
    assert.equal(welcome.seat,0);
    const restored=(await rejoined.wait(m=>m.type==='map'&&!!m.map?.match)).map;
    assert.equal(restored.match.turn,1);
    rejoined.close();
    for(const p of clients)p.close();
    await delay(350);
    // Persistencia cuando no queda ninguna ventana abierta.
    const again=player('Después de cerrar',room,clients[0].token);
    await again.open;
    assert.equal((await again.wait(m=>m.type==='welcome')).seat,0);
    assert.equal((await again.wait(m=>m.type==='map'&&!!m.map?.match)).map.match.turn,1);
    again.close();
    console.log('OK: '+count+' jugadores, lobby, CU, turnos y reconexión');
  }finally{
    for(const p of clients)if(p.ws.readyState<2)p.close();
  }
}
try{
  await ready();
  for(const count of [2,3,4])await play(count);
  console.log('Hito 3: smoke tests de servidor aprobados');
}catch(error){
  console.error(error);
  console.error(output);
  process.exitCode=1;
}finally{
  runner.kill('SIGTERM');
  // No dejar al ejecutor CI retenido por sockets abiertos del proceso local.
  setTimeout(()=>process.exit(process.exitCode??0),1500).unref();
}
