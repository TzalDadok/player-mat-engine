import { DurableObject } from 'cloudflare:workers';

interface Env { GAME_ROOMS: DurableObjectNamespace; ASSETS: Fetcher }
type Member = { id: string; name: string };
type Hex = { q: number; r: number; type: string };
type Placement = { seat: number; q: number; r: number };
type MapState = { seed: number; count: number; hexes: Hex[]; centers?: Placement[] };

const types = ['Frutos silvestres','Animales','Cantera de Oro','Cantera de Piedra','Bosque','Agua','Desierto','Llanura','Montaña'];
const neighbors = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function generateMap(count: number, seed: number): MapState {
  let rng = seed >>> 0;
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  // Cada jugador aporta dos Aguas: una A y una B.
  const terrains = types.filter(t => t !== 'Agua').flatMap(t => Array.from({ length: count * 2 }, () => t));
  terrains.push(...Array.from({length:count},()=> 'Agua A'),...Array.from({length:count},()=> 'Agua B'));
  for(let i = terrains.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [terrains[i],terrains[j]] = [terrains[j],terrains[i]]; }
  // Anillos completos desde la Maravilla: el mapa de 2 jugadores forma
  // un hexágono perfecto de radio 3 (36 terrenos + centro).
  // Para 3/4 jugadores, distribuir la grada exterior en forma equilibrada.
  const coords: {q:number;r:number}[] = [{q:0,r:0}];
  for (let radius = 1; coords.length < count*18+1; radius++) {
    const ring: {q:number;r:number}[] = [];
    let q = -radius, r = radius;
    for(const [dq,dr] of neighbors) {
      for(let step=0;step<radius;step++) {
        ring.push({q,r}); q+=dq; r+=dr;
      }
    }
    const remaining = count*18+1-coords.length;
    if (remaining >= ring.length) coords.push(...ring);
    else {
      // Repartimos los hexágonos restantes de forma contigua y simétrica
      // en un sector de la grada exterior, evitando huecos interiores.
      const startIndex = Math.floor(random()*ring.length);
      for(let i=0;i<remaining;i++) coords.push(ring[(startIndex+i)%ring.length]);
    }
  }
  return {seed,count,hexes:coords.slice(1).map((p,i)=>({...p,type:terrains[i]})),centers:[]};
}
function isCompact(map:MapState):boolean {
  if(map.hexes.length!==map.count*18)return false;
  const occupied=new Set(map.hexes.map(h=>h.q+','+h.r));
  const required=map.count===2 ? 3 : map.count===3 ? 3 : 4;
  for(let q=-required;q<=required;q++)for(let r=-required;r<=required;r++)
    if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=required &&
       (q!==0||r!==0) && !occupied.has(q+','+r))return false;
  return true;
}
export class GameRoom extends DurableObject<Env> {
  private map: MapState | null = null;
  private seat(ws:WebSocket): number { return this.ctx.getWebSockets().indexOf(ws); }
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>{
      this.map = (await ctx.storage.get<MapState>('map')) ?? null;
      // Mapas creados antes de reservar el centro se regeneran con la misma semilla.
      if(this.map && (this.map.hexes.some(h=>h.q===0&&h.r===0) || !isCompact(this.map) || this.map.hexes.some(h=>h.type==='Agua'))){
        this.map=generateMap(this.map.count,this.map.seed);
        await ctx.storage.put('map',this.map);
      }
    });
  }
  async fetch(request: Request): Promise<Response> {
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('WebSocket required',{status:426});
    if(this.ctx.getWebSockets().length>=4)return new Response('Sala llena (4 jugadores)',{status:409});
    const pair=new WebSocketPair();const [client,server]=Object.values(pair);
    const name=(new URL(request.url).searchParams.get('name')||'Jugador').trim().slice(0,24)||'Jugador';
    const id=crypto.randomUUID();
    this.ctx.acceptWebSocket(server);server.serializeAttachment({id,name});
    server.send(JSON.stringify({type:'welcome',id,room:new URL(request.url).pathname.slice(4),seat:this.seat(server)}));
    server.send(JSON.stringify({type:'map',map:this.map}));
    this.broadcastLobby();
    return new Response(null,{status:101,webSocket:client});
  }
  private broadcast(packet:unknown){const message=JSON.stringify(packet);for(const ws of this.ctx.getWebSockets()){try{ws.send(message)}catch{}}}
  private broadcastLobby(){
    const players:Member[]=this.ctx.getWebSockets().map(ws=>ws.deserializeAttachment() as Member).filter(Boolean);
    this.broadcast({type:'lobby',players});
    this.ctx.getWebSockets().forEach((ws,seat)=>{ try{ws.send(JSON.stringify({type:'seat',seat}))}catch{} });
  }
  async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
    if(typeof message!=='string'||message.length>1024)return;
    let packet:{type:string;count?:number;q?:number;r?:number};
    try{packet=JSON.parse(message)}catch{return}
    if(packet.type==='ping'){ws.send(JSON.stringify({type:'pong',time:Date.now()}));return}
    if(packet.type==='place_cu'){
      if(!this.map){ws.send(JSON.stringify({type:'error',message:'Primero generá el mapa.'}));return}
      const seat=this.seat(ws), q=packet.q, r=packet.r;
      if(seat<0||seat>=this.map.count){ws.send(JSON.stringify({type:'error',message:'No tenés un puesto en este mapa.'}));return}
      if(!Number.isInteger(q)||!Number.isInteger(r)||Math.abs(q!)>12||Math.abs(r!)>12){ws.send(JSON.stringify({type:'error',message:'Posición inválida.'}));return}
      const placed=this.map.centers??[];
      if(placed.some(p=>p.seat===seat)){ws.send(JSON.stringify({type:'error',message:'Ya colocaste tu Centro Urbano.'}));return}
      if(placed.some(p=>p.q===q&&p.r===r)||this.map.hexes.some(h=>h.q===q&&h.r===r)||(q===0&&r===0)){
        ws.send(JSON.stringify({type:'error',message:'Esa casilla ya está ocupada.'}));return;
      }
      const valid=this.map.hexes.some(h=>neighbors.some(([dq,dr])=>h.q+dq===q&&h.r+dr===r));
      if(!valid){ws.send(JSON.stringify({type:'error',message:'Elegí una casilla exterior adyacente al mapa.'}));return}
      this.map.centers=[...placed,{seat,q:q!,r:r!}];
      await this.ctx.storage.put('map',this.map);
      this.broadcast({type:'map',map:this.map});
      return;
    }
    if(packet.type==='generate'){
      const sockets=this.ctx.getWebSockets();
      if(sockets[0]!==ws){ws.send(JSON.stringify({type:'error',message:'Solo quien creó la sala puede generar el mapa.'}));return}
      const count=Number(packet.count);
      if(!Number.isInteger(count)||count<2||count>4){ws.send(JSON.stringify({type:'error',message:'Seleccioná entre 2 y 4 jugadores.'}));return}
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      if(this.ctx.getWebSockets().length>count){ws.send(JSON.stringify({type:'error',message:'Hay más jugadores conectados que puestos en el mapa.'}));return}
      this.map=generateMap(count,seed);
      await this.ctx.storage.put('map',this.map);
      this.broadcast({type:'map',map:this.map});
    }
  }
  async webSocketClose(){this.broadcastLobby()}
  async webSocketError(){this.broadcastLobby()}
}
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return Response.json({name:'AoE BoardGame Digital',milestone:2,status:'online'});
    if(url.pathname.startsWith('/ws/')){
      const room=url.pathname.slice(4);
      if(!/^[a-zA-Z0-9_-]{3,30}$/.test(room))return new Response('Código de sala inválido',{status:400});
      return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(room)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
