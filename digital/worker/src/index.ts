import { DurableObject } from 'cloudflare:workers';

interface Env { GAME_ROOMS: DurableObjectNamespace; ASSETS: Fetcher }
type Member = { id: string; name: string };
type Hex = { q: number; r: number; type: string };
type Placement = { seat: number; q: number; r: number };
type Resource='food'|'wood'|'stone'|'gold';
type Unit={id:string;seat:number;q:number;r:number;kind:'Aldeano'};
type Structure={seat:number;q:number;r:number;kind:'Campamento Productivo'|'Granja'|'Cuartel'};
type PlayerState={age:number;pm:number;resources:Record<Resource,number>;techs:string[]};
type Match={round:number;turn:number;phase:0|1|2;players:Record<number,PlayerState>;units:Unit[];buildings:Structure[];log:string[]};
type MapState = {match?:Match; seed: number; count: number; hexes: Hex[]; centers?: Placement[]; order?: number[]; civs?: Record<number,number>; started?: boolean; setupConfirmed?: boolean; draft?: Placement|null; ready?:Record<number,boolean> };

const types = ['Frutos silvestres','Animales','Cantera de Oro','Cantera de Piedra','Bosque','Agua','Desierto','Llanura','Montaña'];
const neighbors = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function generateMap(count: number, seed: number): MapState {
  let rng = seed >>> 0;
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  // Tableros regulares: 2 jugadores = 2 anillos; 3 o 4 = 3 anillos.
  // Cada tipo terrestre aparece equilibradamente, con ambas variantes de agua.
  const rings = count === 2 ? 2 : 3;
  // Cada set tiene exactamente 18 piezas: 2 de cada tipo primario
  // (Frutos, Animales, Oro, Piedra, Bosque), 2 de cada secundario
  // (Agua, Desierto, Llanura, Montaña); las dos Aguas son A y B.
  const set = types.filter(t => t !== 'Agua')
    .flatMap(t => [t,t]).concat(['Agua A','Agua B']);
  const sets = count === 2 ? 1 : 2;
  const terrains = Array.from({length:sets},()=>set).flat();
  for(let i = terrains.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [terrains[i],terrains[j]] = [terrains[j],terrains[i]];
  }
  const coords: {q:number;r:number}[] = [{q:0,r:0}];
  for (let radius = 1; radius <= rings; radius++) {
    let q = -radius, r = radius;
    for(const [dq,dr] of neighbors) {
      for(let step=0;step<radius;step++) {
        coords.push({q,r}); q+=dq; r+=dr;
      }
    }
  }
  if (terrains.length !== coords.length-1) throw new Error('Cantidad de terrenos incorrecta');
  return {seed,count,hexes:coords.slice(1).map((p,i)=>({...p,type:terrains[i]})),centers:[],order:Array.from({length:count},(_,i)=>i),civs:{},started:false,setupConfirmed:false,draft:null,ready:{}};
}
function isCompact(map:MapState):boolean {
  const expected = map.count===2 ? 18 : 36;
  if(map.hexes.length!==expected)return false;
  const occupied=new Set(map.hexes.map(h=>h.q+','+h.r));
  const required=map.count===2 ? 2 : 3;
  for(let q=-required;q<=required;q++)for(let r=-required;r<=required;r++)
    if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=required &&
       (q!==0||r!==0) && !occupied.has(q+','+r))return false;
  return true;
}

// Estado de juego: los costes que aún no están fijados en el reglamento
// se mantienen deshabilitados hasta su definición, nunca se inventan.
const key=(q:number,r:number)=>q+','+r;
const range=(a:{q:number;r:number},b:{q:number;r:number})=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
const resourceFor=(t:string):Resource|null=>t==='Bosque'?'wood':t==='Cantera de Oro'?'gold':t==='Cantera de Piedra'?'stone':t==='Animales'||t==='Frutos silvestres'?'food':null;
function prepareMatch(map:MapState):Match{
  const order=map.order??Array.from({length:map.count},(_,i)=>i);
  const units:Unit[]=[];
  const players:Record<number,PlayerState>={};
  for(let i=0;i<map.count;i++){
    const seat=order[i],cu=map.centers!.find(p=>p.seat===seat)!;
    // Para 4 jugadores se conserva la distribución acordada 1/1/2/2.
    // Para 2-3 jugadores se usa 1 aldeano inicial; balance por cerrar.
    const initial=map.count===4?(i<2?1:2):1;
    const tiles=map.hexes.filter(h=>range(h,cu)===1&&h.type!=='Agua A'&&h.type!=='Agua B'&&h.type!=='Montaña');
    for(let k=0;k<Math.min(initial,tiles.length);k++)units.push({id:crypto.randomUUID(),seat,q:tiles[k].q,r:tiles[k].r,kind:'Aldeano'});
    players[seat]={age:1,pm:map.count===4&&(i===0||i===3)?1:0,resources:{food:0,wood:0,stone:0,gold:0},techs:[]};
  }
  return {round:1,turn:0,phase:0,players,units,buildings:[],log:['La partida comenzó.']};
}

export class GameRoom extends DurableObject<Env> {
  private map: MapState | null = null;
  private seatTokens:Record<number,string>={};
  private seat(ws:WebSocket): number { return (ws.deserializeAttachment() as (Member & {seat:number})|null)?.seat ?? -1; }
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>{
      this.map = (await ctx.storage.get<MapState>('map')) ?? null;
      this.seatTokens=(await ctx.storage.get<Record<number,string>>('seatTokens'))??{};
      // Migrar solamente salas sin CU. Nunca borrar colocaciones existentes.
      // Las salas de la versión anterior se actualizan al reconectarse.
      if(this.map && !(this.map.centers?.length) &&
        (!isCompact(this.map) || this.map.hexes.some(h=>h.type==='Agua'))) {
        const order=this.map.order;
        this.map=generateMap(this.map.count,this.map.seed);
        if(order?.length===this.map.count) this.map.order=order;
        await ctx.storage.put('map',this.map);
      }
    });
  }
  async fetch(request: Request): Promise<Response> {
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket') return new Response('WebSocket required',{status:426});
    const connected=this.ctx.getWebSockets();
    const used=new Set(connected.map(ws=>this.seat(ws)));
    const token=new URL(request.url).searchParams.get('token')??'';
    if(!/^[a-f0-9-]{36}$/i.test(token))return new Response('Identidad de jugador inválida',{status:400});
    const savedSeat=Object.entries(this.seatTokens).find(([,saved])=>saved===token);
    const count=this.map?.count??4;
    let seat=savedSeat?Number(savedSeat[0]):-1;
    if(seat>=count)return new Response('El puesto ya no pertenece a esta partida',{status:409});
    if(seat>=0&&used.has(seat)){
      // Un código legítimo puede sustituir una conexión anterior que quedó
      // abierta (por ejemplo, al perder señal en el celular).
      for(const old of connected.filter(sock=>this.seat(sock)===seat)){
        try{old.close(1000,'Reconectado desde otra ventana')}catch{}
      }
    }
    if(seat<0){
      // Las partidas antiguas no tenían identidades persistentes. Permitir
      // recuperar una plaza libre, sin sobrescribir jugadores identificados.
      seat=Array.from({length:count},(_,i)=>i).find(i=>!used.has(i)&&!this.seatTokens[i])??-1;
      if(seat<0)return new Response('Sala llena o puestos reservados',{status:409});
      this.seatTokens[seat]=token;
      await this.ctx.storage.put('seatTokens',this.seatTokens);
    }
    const pair=new WebSocketPair();const [client,server]=Object.values(pair);
    const name=(new URL(request.url).searchParams.get('name')||'Jugador').trim().slice(0,24)||'Jugador';
    const id=token;
    this.ctx.acceptWebSocket(server);server.serializeAttachment({id,name,seat});
    server.send(JSON.stringify({type:'welcome',id,room:new URL(request.url).pathname.slice(4),seat:this.seat(server)}));
    server.send(JSON.stringify({type:'map',map:this.map}));
    this.broadcastLobby();
    return new Response(null,{status:101,webSocket:client});
  }
  private broadcast(packet:unknown){const message=JSON.stringify(packet);for(const ws of this.ctx.getWebSockets()){try{ws.send(message)}catch{}}}
  private broadcastLobby(){
    const players:(Member & {seat:number})[]=this.ctx.getWebSockets().map(ws=>ws.deserializeAttachment() as Member & {seat:number}).filter(Boolean);
    players.sort((a,b)=>a.seat-b.seat);
    this.broadcast({type:'lobby',players});
    this.ctx.getWebSockets().forEach(ws=>{ try{ws.send(JSON.stringify({type:'seat',seat:this.seat(ws)}))}catch{} });
  }
  async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
    if(typeof message!=='string'||message.length>1024)return;
    let packet:{type:string;count?:number;q?:number;r?:number;order?:number[];civ?:number;ready?:boolean;action?:string;unit?:string;hexes?:{q:number;r:number}[]};
    try{packet=JSON.parse(message)}catch{return}
    if(packet.type==='ping'){ws.send(JSON.stringify({type:'pong',time:Date.now()}));return}
    if(packet.type==='game_action'){
      const map=this.map,match=map?.match,seat=this.seat(ws);
      if(!map||!match||!map.started||seat!==(map.order??[])[match.turn]){
        ws.send(JSON.stringify({type:'error',message:'No es tu turno o la partida todavía no está preparada.'}));return;
      }
      const action=packet.action;
      const fail=(message:string)=>ws.send(JSON.stringify({type:'error',message}));
      const player=match.players[seat];
      const phase=match.phase;
      if(action==='pass'){
        match.log.unshift('Jugador '+(seat+1)+' pasó la fase '+['económica','tecnológica','militar'][phase]);
      }else if(action==='produce'&&phase===0){
        const list=packet.hexes;
        const max=[2,3,3,4][player.age-1];
        if(!Array.isArray(list)||list.length===0||list.length>max||new Set(list.map(p=>key(p.q,p.r))).size!==list.length){fail('Elegí de 1 a '+max+' hexágonos distintos.');return}
        const gained:Record<Resource,number>={food:0,wood:0,stone:0,gold:0};
        for(const pos of list){
          if(!Number.isInteger(pos.q)||!Number.isInteger(pos.r)){fail('Casilla inválida.');return}
          const hex=map.hexes.find(h=>h.q===pos.q&&h.r===pos.r);
          const resource=hex&&resourceFor(hex.type);
          if(!resource){fail('Ese terreno no produce recursos.');return}
          const workers=match.units.some(u=>u.seat===seat&&u.q===pos.q&&u.r===pos.r);
          const camp=match.buildings.some(b=>b.seat===seat&&b.q===pos.q&&b.r===pos.r&&b.kind==='Campamento Productivo');
          if(!workers&&!camp){fail('No controlás uno de los terrenos seleccionados.');return}
          gained[resource]+=(workers?1:0)+(camp?2:0);
        }
        for(const res of Object.keys(gained) as Resource[])player.resources[res]+=gained[res];
        match.log.unshift('Jugador '+(seat+1)+' produjo '+JSON.stringify(gained));
      }else if(action==='move'&&phase===0){
        const unit=match.units.find(u=>u.id===packet.unit&&u.seat===seat);
        if(!unit||!Number.isInteger(packet.q)||!Number.isInteger(packet.r)){fail('Elegí un aldeano y destino válidos.');return}
        const target=map.hexes.find(h=>h.q===packet.q&&h.r===packet.r);
        if(!target||range(unit,{q:packet.q!,r:packet.r!})!==1||['Agua A','Agua B','Montaña'].includes(target.type)){fail('El aldeano debe moverse un hexágono terrestre adyacente.');return}
        if(match.units.some(u=>u.seat!==seat&&u.q===packet.q&&u.r===packet.r)){fail('El territorio está ocupado por otro jugador.');return}
        unit.q=packet.q!;unit.r=packet.r!;
        match.log.unshift('Jugador '+(seat+1)+' movió un aldeano.');
      }else{
        fail('Acción no disponible en esta fase. Las acciones sin costes definidos se habilitarán cuando estén confirmados.');return;
      }
      if(match.phase===2){match.phase=0;match.turn++;if(match.turn>=map.count){match.turn=0;match.round++}}
      else match.phase=(match.phase+1) as 0|1|2;
      match.log=match.log.slice(0,40);
      await this.ctx.storage.put('map',map);this.broadcast({type:'map',map});return;
    }
    if(packet.type==='choose_civ'){
      const seat=this.seat(ws), civ=packet.civ;
      if(!this.map||this.map.started||!this.map.setupConfirmed){ws.send(JSON.stringify({type:'error',message:'Confirmá primero la configuración.'}));return}
      if(seat<0||seat>=this.map.count||!Number.isInteger(civ)||civ!<0||civ!>3){ws.send(JSON.stringify({type:'error',message:'Civilización inválida.'}));return}
      if((this.map.centers??[]).some(p=>p.seat===seat)){ws.send(JSON.stringify({type:'error',message:'No podés cambiar civilización después de colocar el CU.'}));return}
      if(Object.entries(this.map.civs??{}).some(([s,v])=>Number(s)!==seat&&v===civ)){ws.send(JSON.stringify({type:'error',message:'Esa civilización ya está elegida.'}));return}
      this.map.civs={...this.map.civs,[seat]:civ!};this.map.ready={...this.map.ready,[seat]:false};
      await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='set_ready'){
      if(!this.map||!this.map.setupConfirmed||this.map.started)return;
      const seat=this.seat(ws);
      if(seat<0||seat>=this.map.count||!Number.isInteger(this.map.civs?.[seat]))return;
      this.map.ready={...this.map.ready,[seat]:packet.ready===true};
      await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='start_game'){
      if(!this.map||this.map.started)return;
      if(this.seat(ws)!==0){ws.send(JSON.stringify({type:'error',message:'Solo el anfitrión puede iniciar.'}));return}
      const sockets=this.ctx.getWebSockets(),civs=this.map.civs??{},ready=this.map.ready??{};
      if(!this.map.setupConfirmed||sockets.length!==this.map.count||
        !Array.from({length:this.map.count},(_,s)=>s).every(s=>sockets.some(sock=>this.seat(sock)===s)&&Number.isInteger(civs[s])&&ready[s]===true)||
        new Set(Object.values(civs)).size!==this.map.count){
        ws.send(JSON.stringify({type:'error',message:'Todos deben conectarse, seleccionar civilización única y marcar Ready.'}));return;
      }
      this.map.started=true;await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='confirm_setup'){
      if(!this.map||this.map.setupConfirmed||this.map.started)return;
      if(this.seat(ws)!==0){ws.send(JSON.stringify({type:'error',message:'Solo el anfitrión puede confirmar la configuración.'}));return}
      this.map.setupConfirmed=true;await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='confirm_cu'){
      if(!this.map||!this.map.setupConfirmed||!this.map.started)return;
      const seat=this.seat(ws),draft=this.map.draft,placed=this.map.centers??[],order=this.map.order??Array.from({length:this.map.count},(_,i)=>i);
      if(!draft||draft.seat!==seat||order[placed.length]!==seat)return;
      this.map.centers=[...placed,draft];this.map.draft=null;
      if(this.map.centers.length===this.map.count&&!this.map.match)this.map.match=prepareMatch(this.map);
      await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='place_cu'){
      if(!this.map){ws.send(JSON.stringify({type:'error',message:'Primero generá el mapa.'}));return}
      if(!this.map.started){ws.send(JSON.stringify({type:'error',message:'Primero iniciá la partida.'}));return}
      const seat=this.seat(ws), q=packet.q, r=packet.r;
      if(!Number.isInteger(this.map.civs?.[seat])){ws.send(JSON.stringify({type:'error',message:'Elegí tu civilización antes de colocar el CU.'}));return}
      if(seat<0||seat>=this.map.count){ws.send(JSON.stringify({type:'error',message:'No tenés un puesto en este mapa.'}));return}
      if(!Number.isInteger(q)||!Number.isInteger(r)||Math.abs(q!)>12||Math.abs(r!)>12){ws.send(JSON.stringify({type:'error',message:'Posición inválida.'}));return}
      const placed=this.map.centers??[];
      const order=this.map.order??Array.from({length:this.map.count},(_,i)=>i);
      if(order[placed.length]!==seat){ws.send(JSON.stringify({type:'error',message:'Todavía no es tu turno para colocar el CU.'}));return}
      if(placed.some(p=>p.seat===seat)){ws.send(JSON.stringify({type:'error',message:'Ya colocaste tu Centro Urbano.'}));return}
      if(placed.some(p=>Math.max(Math.abs(p.q-q!),Math.abs(p.r-r!),Math.abs((p.q+p.r)-(q!+r!)))<=1)){
        ws.send(JSON.stringify({type:'error',message:'No podés colocar el CU adyacente a otro CU.'}));return;
      }
      if(placed.some(p=>p.q===q&&p.r===r)||this.map.hexes.some(h=>h.q===q&&h.r===r)||(q===0&&r===0)){
        ws.send(JSON.stringify({type:'error',message:'Esa casilla ya está ocupada.'}));return;
      }
      const valid=this.map.hexes.some(h=>neighbors.some(([dq,dr])=>h.q+dq===q&&h.r+dr===r));
      if(!valid){ws.send(JSON.stringify({type:'error',message:'Elegí una casilla exterior adyacente al mapa.'}));return}
      this.map.draft={seat,q:q!,r:r!};
      await this.ctx.storage.put('map',this.map);
      this.broadcast({type:'map',map:this.map});
      return;
    }
    if(packet.type==='set_order'){
      if(!this.map){ws.send(JSON.stringify({type:'error',message:'Generá un mapa primero.'}));return}
      if(this.map.started||!this.map.setupConfirmed){ws.send(JSON.stringify({type:'error',message:'Confirmá primero la configuración.'}));return}
      const leader=Math.min(...this.ctx.getWebSockets().map(s=>this.seat(s)));
      if(this.seat(ws)!==leader){ws.send(JSON.stringify({type:'error',message:'Solo el anfitrión puede definir el orden.'}));return}
      if(Object.values(this.map.ready??{}).some(Boolean)){ws.send(JSON.stringify({type:'error',message:'El orden está bloqueado porque hay jugadores Ready.'}));return}
      const order=packet.order;
      if(!Array.isArray(order)||order.length!==this.map.count||order.some(n=>!Number.isInteger(n)||n<0||n>=this.map!.count)||new Set(order).size!==this.map.count){ws.send(JSON.stringify({type:'error',message:'El orden debe incluir a todos los jugadores una sola vez.'}));return}
      this.map.order=[...order];
      await this.ctx.storage.put('map',this.map);
      this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='generate'){
      const sockets=this.ctx.getWebSockets();
      if(this.seat(ws)!==Math.min(...sockets.map(s=>this.seat(s)))){ws.send(JSON.stringify({type:'error',message:'Solo quien creó la sala puede generar el mapa.'}));return}
      const count=Number(packet.count);
      if(!Number.isInteger(count)||count<2||count>4){ws.send(JSON.stringify({type:'error',message:'Seleccioná entre 2 y 4 jugadores.'}));return}
      if(this.map){ws.send(JSON.stringify({type:'error',message:'El mapa ya está generado y bloqueado.'}));return}
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      if(this.ctx.getWebSockets().length>count){ws.send(JSON.stringify({type:'error',message:'Hay más jugadores conectados que puestos en el mapa.'}));return}
      this.map=generateMap(count,seed);
      this.map.civs={};
      this.map.setupConfirmed=true;
      await this.ctx.storage.put('map',this.map);
      this.broadcast({type:'map',map:this.map});
    }
  }
  async webSocketClose(ws:WebSocket){
    // No invalidar Ready cuando una conexión antigua fue sustituida por otra
    // con el mismo puesto.
    if(this.ctx.getWebSockets().some(other=>other!==ws&&this.seat(other)===this.seat(ws))){
      this.broadcastLobby();return;
    }
    if(this.map&&!this.map.started){const seat=this.seat(ws);this.map.ready={...this.map.ready,[seat]:false};await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map})}this.broadcastLobby()}
  async webSocketError(ws:WebSocket){await this.webSocketClose(ws)}
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
