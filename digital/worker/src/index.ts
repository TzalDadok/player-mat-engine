import { DurableObject } from 'cloudflare:workers';

interface Env { GAME_ROOMS: DurableObjectNamespace; ASSETS: Fetcher }
type Member = { id: string; name: string };
type Hex = { q: number; r: number; type: string };
type MapState = { seed: number; count: number; hexes: Hex[] };

const types = ['Frutos silvestres','Animales','Cantera de Oro','Cantera de Piedra','Bosque','Agua','Desierto','Llanura','Montaña'];
const neighbors = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const key = (q: number, r: number) => q + ',' + r;
function generateMap(count: number, seed: number): MapState {
  let rng = seed >>> 0;
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  const terrains = types.flatMap(t => Array.from({ length: count * 2 }, () => t));
  for(let i = terrains.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [terrains[i],terrains[j]] = [terrains[j],terrains[i]]; }
  const coords = [{q:0,r:0}];
  const used = new Set([key(0,0)]);
  while(coords.length < count * 18 + 1) {
    const candidates = new Map<string,{q:number;r:number}>();
    for (const p of coords) for(const [dq,dr] of neighbors) {
      const q=p.q+dq,r=p.r+dr,k=key(q,r);
      if(!used.has(k)) candidates.set(k,{q,r});
    }
    const pool = [...candidates.values()].map(p => ({
      ...p, score: Math.max(Math.abs(p.q),Math.abs(p.r),Math.abs(p.q+p.r)) + random()*2.3
    })).sort((a,b)=>a.score-b.score);
    const next=pool[0];
    coords.push({q:next.q,r:next.r});used.add(key(next.q,next.r));
  }
  return {seed,count,hexes:coords.slice(1).map((p,i)=>({...p,type:terrains[i]}))};
}
export class GameRoom extends DurableObject<Env> {
  private map: MapState | null = null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>{this.map = (await ctx.storage.get<MapState>('map')) ?? null;});
  }
  async fetch(request: Request): Promise<Response> {
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('WebSocket required',{status:426});
    if(this.ctx.getWebSockets().length>=4)return new Response('Sala llena (4 jugadores)',{status:409});
    const pair=new WebSocketPair();const [client,server]=Object.values(pair);
    const name=(new URL(request.url).searchParams.get('name')||'Jugador').trim().slice(0,24)||'Jugador';
    const id=crypto.randomUUID();
    this.ctx.acceptWebSocket(server);server.serializeAttachment({id,name});
    server.send(JSON.stringify({type:'welcome',id,room:new URL(request.url).pathname.slice(4)}));
    server.send(JSON.stringify({type:'map',map:this.map}));
    this.broadcastLobby();
    return new Response(null,{status:101,webSocket:client});
  }
  private broadcast(packet:unknown){const message=JSON.stringify(packet);for(const ws of this.ctx.getWebSockets()){try{ws.send(message)}catch{}}}
  private broadcastLobby(){
    const players:Member[]=this.ctx.getWebSockets().map(ws=>ws.deserializeAttachment() as Member).filter(Boolean);
    this.broadcast({type:'lobby',players});
  }
  async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
    if(typeof message!=='string'||message.length>1024)return;
    let packet:{type:string;count?:number};
    try{packet=JSON.parse(message)}catch{return}
    if(packet.type==='ping'){ws.send(JSON.stringify({type:'pong',time:Date.now()}));return}
    if(packet.type==='generate'){
      const sockets=this.ctx.getWebSockets();
      if(sockets[0]!==ws){ws.send(JSON.stringify({type:'error',message:'Solo quien creó la sala puede generar el mapa.'}));return}
      const count=Number(packet.count);
      if(!Number.isInteger(count)||count<2||count>4){ws.send(JSON.stringify({type:'error',message:'Seleccioná entre 2 y 4 jugadores.'}));return}
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
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
