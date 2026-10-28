import { DurableObject } from 'cloudflare:workers';
import matData from './mats.generated.json';

interface Env { GAME_ROOMS: DurableObjectNamespace; ASSETS: Fetcher }
type Member = { id: string; name: string };
type Hex = { q: number; r: number; type: string };
type Placement = { seat: number; q: number; r: number };
type Resource='food'|'wood'|'stone'|'gold';
type Unit={id:string;seat:number;q:number;r:number;kind:'Aldeano'};
type Structure={seat:number;q:number;r:number;kind:'Campamento Productivo'|'Granja'|'Cuartel'|'Torre'|'Puerto';builtAge?:number};
type PlayerState={age:number;pm:number;resources:Record<Resource,number>;techs:string[]};
type Match={round:number;turn:number;phase:0|1|2;players:Record<number,PlayerState>;units:Unit[];buildings:Structure[];log:string[];market:Record<'food'|'wood'|'stone',number>;stock:Record<string,Record<Resource,number>>};
type MapState = {match?:Match; seed: number; count: number; hexes: Hex[]; centers?: Placement[]; order?: number[]; civs?: Record<number,number>; started?: boolean; setupConfirmed?: boolean; draft?: Placement|null; initialVillagers?:Record<number,{q:number;r:number}>; awaitingVillager?:number; ready?:Record<number,boolean> };

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
type Cost=Partial<Record<Resource,number>>;
const mats=matData as unknown as Record<string,{buildings:{name:string;cost:Cost}[];nodes:{age:string;building:string;type:string;title:string;cost:Cost}[]}>;
const civName=(map:MapState,seat:number)=>['britones','francos','vikingos','persas'][map.civs?.[seat]??0];
const civMat=(map:MapState,seat:number)=>mats[civName(map,seat)];
const ageNames=['dark','feudal','castles','imperial'];
function getMatNode(map:MapState,seat:number,title:string,type:string,age:number){
  return civMat(map,seat).nodes.filter(n=>n.title===title&&n.type===type&&ageNames.indexOf(n.age)<age)
    .sort((a,b)=>ageNames.indexOf(b.age)-ageNames.indexOf(a.age))[0];
}
function getMatBuild(map:MapState,seat:number,title:string){
  return civMat(map,seat).buildings.find(b=>b.name===title);
}
const ages:Cost[]=[{}, {food:4,wood:2,stone:1,gold:1},{food:6,wood:4,stone:2,gold:2},{food:8,wood:6,stone:4,gold:5}];
function afford(resources:Record<Resource,number>,cost:Cost){return (Object.entries(cost) as [Resource,number][]).every(([r,v])=>resources[r]>=v)}

const emptyStock=():Record<Resource,number>=>({food:0,wood:0,stone:0,gold:0});
function control(map:MapState,match:Match,seat:number,q:number,r:number){
  const own=match.units.some(u=>u.seat===seat&&u.q===q&&u.r===r)||
    match.buildings.some(b=>b.seat===seat&&b.q===q&&b.r===r)||
    (map.centers??[]).some(c=>c.seat===seat&&c.q===q&&c.r===r);
  const enemy=match.units.some(u=>u.seat!==seat&&u.q===q&&u.r===r);
  return own&&!enemy;
}
function ownedStockKeys(map:MapState,match:Match,seat:number){
  return Object.keys(match.stock).filter(k=>{
    const [q,r]=k.split(',').map(Number);return control(map,match,seat,q,r);
  });
}
function wallet(map:MapState,match:Match,seat:number){
  const value=emptyStock();
  for(const k of ownedStockKeys(map,match,seat))
    for(const resource of Object.keys(value) as Resource[])value[resource]+=(match.stock[k]?.[resource]??0);
  return value;
}
function updateWallets(map:MapState,match:Match){
  for(const seat of Object.keys(match.players).map(Number))match.players[seat].resources=wallet(map,match,seat);
}
function deposit(match:Match,q:number,r:number,resource:Resource,amount:number){
  const k=key(q,r);match.stock[k]??=emptyStock();match.stock[k][resource]+=amount;
}
function debit(map:MapState,match:Match,seat:number,cost:Cost){
  if(!afford(wallet(map,match,seat),cost))return false;
  const controlled=ownedStockKeys(map,match,seat);
  for(const [resource,total] of Object.entries(cost) as [Resource,number][]){
    let remaining=total;
    for(const k of controlled){
      const take=Math.min(remaining,match.stock[k][resource]??0);
      match.stock[k][resource]-=take;remaining-=take;if(!remaining)break;
    }
  }
  return true;
}
const resourceFor=(t:string):Resource|null=>t==='Bosque'?'wood':t==='Cantera de Oro'?'gold':t==='Cantera de Piedra'?'stone':t==='Animales'||t==='Frutos silvestres'?'food':null;
function prepareMatch(map:MapState):Match{
  const order=map.order??Array.from({length:map.count},(_,i)=>i);
  const units:Unit[]=[];
  const players:Record<number,PlayerState>={};
  for(let i=0;i<map.count;i++){
    const seat=order[i],cu=map.centers!.find(p=>p.seat===seat)!;
    // La distribución depende exclusivamente del orden de colocación del CU: 1/1/2/2.
    const initial=i<2?1:2;
    // Preferimos que los aldeanos iniciales puedan producir desde su primera acción.
    // Montaña es transitable y se utiliza si no hay mejores terrenos adyacentes.
    const tiles=map.hexes.filter(h=>range(h,cu)===1&&!h.type.startsWith('Agua'));
    const uncontested=tiles.filter(h=>!units.some(u=>u.seat!==seat&&u.q===h.q&&u.r===h.r));
    // Evitar compartir el territorio inicial con aldeanos enemigos;
    // después, priorizar los terrenos productores.
    const candidates=(uncontested.length?uncontested:tiles)
      .sort((a,b)=>Number(!!resourceFor(b.type))-Number(!!resourceFor(a.type)));
    // Las unidades pueden compartir hexágono: siempre entregar la cantidad
    // inicial, aunque el CU tenga un solo terreno adyacente transitable.
    for(let k=0;k<initial;k++){
      const p=i<2&&k===0&&map.initialVillagers?.[seat]?map.initialVillagers[seat]:(candidates[k%candidates.length]??cu);
      units.push({id:crypto.randomUUID(),seat,q:p.q,r:p.r,kind:'Aldeano'});
    }
    players[seat]={age:1,pm:i===1?1:i===3?2:0,resources:{food:0,wood:0,stone:0,gold:0},techs:[]};
  }
  return {round:1,turn:0,phase:0,players,units,buildings:[],log:['La partida comenzó.'],market:{food:0,wood:0,stone:0},stock:{}};
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
    let packet:{type:string;count?:number;q?:number;r?:number;order?:number[];civ?:number;ready?:boolean;action?:string;unit?:string;units?:string[];kind?:string;hexes?:{q:number;r:number}[];side?:'buy'|'sell';amount?:number;moves?:{unit:string;q:number;r:number;cargo?:Partial<Record<Resource,number>>}[]};
    try{packet=JSON.parse(message)}catch{return}
    if(packet.type==='ping'){ws.send(JSON.stringify({type:'pong',time:Date.now()}));return}
    if(packet.type==='sync'){ws.send(JSON.stringify({type:'map',map:this.map}));this.broadcastLobby();return}
    if(packet.type==='game_action'){
      const map=this.map,match=map?.match,seat=this.seat(ws);
      if(!map||!match||!map.started||seat!==(map.order??[])[match.turn]){
        ws.send(JSON.stringify({type:'error',message:'No es tu turno o la partida todavía no está preparada.'}));return;
      }
      // Compatibilidad con partidas iniciadas antes del inventario territorial.
      if(!match.stock){match.stock={};for(const [s,p] of Object.entries(match.players)){
        const cu=map.centers?.find(c=>c.seat===Number(s));
        if(cu)match.stock[key(cu.q,cu.r)]={...p.resources};
      }}
      updateWallets(map,match);
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
        const yields:{q:number;r:number;resource:Resource;amount:number}[]=[];
        for(const pos of list){
          if(!Number.isInteger(pos.q)||!Number.isInteger(pos.r)){fail('Casilla inválida.');return}
          const hex=map.hexes.find(h=>h.q===pos.q&&h.r===pos.r);
          const farm=match.buildings.filter(b=>b.seat===seat&&b.q===pos.q&&b.r===pos.r&&b.kind==='Granja').length;
          const workers=match.units.filter(u=>u.seat===seat&&u.q===pos.q&&u.r===pos.r).length;
          const camp=match.buildings.some(b=>b.seat===seat&&b.q===pos.q&&b.r===pos.r&&b.kind==='Campamento Productivo');
          const natural=hex&&resourceFor(hex.type);
          const coast=!!hex&&workers>0&&neighbors.some(([dq,dr])=>map.hexes.some(h=>h.q===pos.q+dq&&h.r===pos.r+dr&&h.type.startsWith('Agua')));
          if(!hex||(!natural&&!farm&&!coast)){fail('Ese terreno no produce recursos.');return}
          if(!workers&&!camp||!control(map,match,seat,pos.q,pos.r)){fail('No controlás uno de los hexágonos productores.');return}
          let amount=natural?workers+(camp?2:0)+(natural==='wood'&&player.techs.includes('Doble Filo')?workers:0):farm?2*Math.min(farm,workers):workers;
          if(natural==='food'&&hex?.type==='Animales'&&player.techs.includes('Pastoreo'))amount+=workers;
          if(natural==='food'&&hex?.type==='Frutos silvestres'&&player.techs.includes('Recolección'))amount+=1;
          if(natural==='stone'&&player.techs.includes('Canteros'))amount+=workers;
          if(natural==='stone'&&player.techs.includes('Canteros Reales'))amount+=1;
          if(natural==='gold'&&player.techs.includes('Minería Imperial'))amount+=workers;
          if(natural==='gold'&&player.techs.includes('Explotac. Aurífera'))amount+=workers;
          if(farm&&hex?.type==='Desierto'&&player.techs.includes('Qanats')&&neighbors.some(([dq,dr])=>map.hexes.some(h=>h.q===pos.q+dq&&h.r===pos.r+dr&&h.type==='Montaña')))amount+=1;
          if(camp&&player.techs.includes('Administración Real'))amount+=1;
          const resource=natural??'food';gained[resource]+=amount;
          yields.push({q:pos.q,r:pos.r,resource,amount});
        }
        for(const yieldItem of yields)deposit(match,yieldItem.q,yieldItem.r,yieldItem.resource,yieldItem.amount);
        match.log.unshift('Jugador '+(seat+1)+' produjo '+JSON.stringify(gained));
      }else if(action==='move'&&phase===0){
        // Hasta dos unidades diferentes, con origen y destino independientes.
        // Se valida y aplica toda la orden de forma atómica.
        const moves=packet.moves;
        if(!Array.isArray(moves)||moves.length<1||moves.length>2||
           moves.some(p=>!p||typeof p.unit!=='string'||!Number.isInteger(p.q)||!Number.isInteger(p.r))||
           new Set(moves.map(p=>p.unit)).size!==moves.length){
          fail('Elegí una o dos unidades diferentes y el destino de cada una.');return;
        }
        const selected=moves.map(p=>match.units.find(u=>u.id===p.unit&&u.seat===seat));
        if(selected.some(u=>!u)){fail('Una de las unidades no te pertenece.');return}
        for(let i=0;i<moves.length;i++){
          const dest=moves[i],unit=selected[i]!;
          const terrain=map.hexes.find(h=>h.q===dest.q&&h.r===dest.r);
          if(!terrain||terrain.type.startsWith('Agua')||range(unit,dest)>1||range(unit,dest)<1){
            fail('Cada Aldeano se mueve hasta 1 hexágono terrestre.');return;
          }
          if(match.units.some(u=>u.seat!==seat&&u.q===dest.q&&u.r===dest.r)){
            fail('No podés entrar en un hexágono ocupado por otro jugador.');return;
          }
        }
        // El jugador decide cuánto llevar de cada recurso, sin límite de carga.
        // Solo se retiran fichas del origen si el jugador las controla.
        const requests=new Map<string,Record<Resource,number>>();
        for(let i=0;i<moves.length;i++){
          const move=moves[i],unit=selected[i]!,from=key(unit.q,unit.r);
          const cargo=move.cargo??{};
          if(Object.values(cargo).some(value=>value!==0)&&!player.techs.includes('Carretilla')){
            fail('Necesitás investigar Carretilla antes de transportar recursos.');return;
          }
          const accumulated=requests.get(from)??emptyStock();
          for(const resource of Object.keys(cargo)){
            const amount=(cargo as Record<string,number>)[resource];
            if(!['food','wood','stone','gold'].includes(resource)||!Number.isInteger(amount)||amount<0){
              fail('Cantidad o tipo de recurso inválido.');return;
            }
            accumulated[resource as Resource]+=amount;
          }
          requests.set(from,accumulated);
        }
        for(const [source,items] of requests){
          const [q,r]=source.split(',').map(Number);
          if(Object.values(items).some(v=>v>0)&&!control(map,match,seat,q,r)){
            fail('Solo podés recoger recursos en territorios controlados.');return;
          }
          for(const resource of Object.keys(items) as Resource[]){
            if(items[resource]>(match.stock[source]?.[resource]??0)){
              fail('No hay suficientes recursos en el hexágono de origen.');return;
            }
          }
        }
        for(let i=0;i<moves.length;i++){
          const move=moves[i],unit=selected[i]!,from=key(unit.q,unit.r);
          for(const resource of ['food','wood','stone','gold'] as Resource[]){
            const amount=move.cargo?.[resource]??0;
            if(amount>0){
              match.stock[from][resource]-=amount;
              deposit(match,move.q,move.r,resource,amount);
            }
          }
          unit.q=move.q;unit.r=move.r;
        }
        match.log.unshift('Jugador '+(seat+1)+' movió '+moves.length+' unidad(es) con sus recursos.');
      }else if(action==='trade'&&phase===0){
        const resource=packet.kind as 'food'|'wood'|'stone';
        if(!['food','wood','stone'].includes(resource)||!['buy','sell'].includes(packet.side??'')||
           !Number.isInteger(packet.amount)||packet.amount!<1||packet.amount!>2){fail('Operación de mercado inválida.');return}
        const base={food:{buy:[2,3,4,5,6],sell:[1,1,2,3,4]},
          wood:{buy:[3,4,5,6,7],sell:[1,2,3,4,5]},
          stone:{buy:[4,5,6,7,8],sell:[2,3,4,5,6]}} as const;
        let position=match.market?.[resource]??0;
        let gold=player.resources.gold,quantity=player.resources[resource];
        const originalGold=gold,originalQuantity=quantity;
        for(let n=0;n<packet.amount!;n++){
          const listed=base[resource][packet.side==='buy'?'buy':'sell'][position];
          const value=packet.side==='buy'&&player.techs.includes('Carreta Mercante')?Math.max(0,listed-1):listed;
          if(packet.side==='buy'){
            if(gold<value){fail('No tenés oro suficiente para esa compra.');return}
            gold-=value;quantity++;position=Math.min(4,position+1);
          }else{
            if(quantity<1){fail('No tenés suficientes recursos para vender.');return}
            quantity--;gold+=value;position=Math.max(0,position-1);
          }
        }
        const cu=map.centers?.find(c=>c.seat===seat);
        if(!cu){fail('No tenés un Centro Urbano.');return}
        const spent=packet.side==='buy'?{gold:originalGold-gold}:{[resource]:originalQuantity-quantity};
        if(!debit(map,match,seat,spent)){fail('Los recursos ya no están bajo tu control.');return}
        if(packet.side==='buy')deposit(match,cu.q,cu.r,resource,quantity-originalQuantity);
        else deposit(match,cu.q,cu.r,'gold',gold-originalGold);
        match.market={...(match.market??{food:0,wood:0,stone:0}),[resource]:position};
        match.log.unshift('Jugador '+(seat+1)+' '+(packet.side==='buy'?'compró ':'vendió ')+packet.amount+' '+resource);
      }else if(action==='build'&&phase===0){
        if(!Number.isInteger(packet.q)||!Number.isInteger(packet.r)){fail('Seleccioná una casilla válida.');return}
        const pos={q:packet.q!,r:packet.r!},kind=packet.kind as Structure['kind'];
        if(!['Campamento Productivo','Granja','Cuartel','Torre','Puerto'].includes(kind)){fail('Edificio desconocido.');return}
        const tile=map.hexes.find(h=>h.q===pos.q&&h.r===pos.r);
        if(!tile){fail('Elegí una casilla del mapa.');return}
        const workersHere=match.units.some(u=>u.seat===seat&&u.q===pos.q&&u.r===pos.r);
        const workersAdjacent=match.units.some(u=>u.seat===seat&&range(u,pos)===1);
        if(kind==='Puerto'?!workersAdjacent:!workersHere||!control(map,match,seat,pos.q,pos.r)){fail(kind==='Puerto'?'El Puerto requiere un Aldeano adyacente.':'Necesitás un Aldeano y controlar el hexágono.');return}
        const count=match.buildings.filter(b=>b.q===pos.q&&b.r===pos.r&&b.kind===kind).length;
        if(kind==='Campamento Productivo'&&(!resourceFor(tile.type)||count>=1)){fail('Solo un Campamento Productivo por hexágono de recursos.');return}
        if(kind==='Granja'&&(!((tile.type==='Llanura')||(tile.type==='Desierto'&&player.techs.includes('Qanats')))||count>=2)){fail('La Granja requiere Llanura y un máximo de dos por hexágono.');return}
        if(['Cuartel','Torre'].includes(kind)&&(!['Llanura','Desierto'].includes(tile.type)||match.buildings.some(b=>b.q===pos.q&&b.r===pos.r))){fail('El Cuartel requiere terreno disponible de Llanura o Desierto.');return}
        if(kind==='Puerto'&&(!tile.type.startsWith('Agua')||match.buildings.some(b=>b.q===pos.q&&b.r===pos.r))){fail('El Puerto debe construirse en Agua libre, adyacente a un Aldeano.');return}
        if(kind!=='Granja'&&match.buildings.filter(b=>b.q===pos.q&&b.r===pos.r&&b.kind==='Granja').length>=2){fail('No se permiten otros edificios si hay dos Granjas.');return}
        const matBuild=getMatBuild(map,seat,kind);
        const cost=kind==='Granja'?(player.techs.includes('Rot. de Cultivos')?{}:getMatNode(map,seat,'Granja','building',player.age)?.cost):matBuild?.cost;
        if(!cost){fail('La construcción no está disponible en el Mat de tu civilización.');return}
        if(!debit(map,match,seat,cost)){fail('Recursos insuficientes en hexágonos controlados.');return}
        match.buildings.push({seat,...pos,kind:kind as Structure['kind'],builtAge:player.age});
        match.log.unshift('Jugador '+(seat+1)+' construyó '+kind);
      }else if(action==='train'&&phase===0){
        const cu=map.centers?.find(p=>p.seat===seat);
        const amount=packet.amount??1;
        if(!Number.isInteger(amount)||amount<1||amount>999){fail('Cantidad de Aldeanos inválida.');return}
        const villager=getMatNode(map,seat,'Aldeano','civil',player.age);
        const cost=Object.fromEntries(Object.entries(villager?.cost??{}).map(([r,value])=>[r,value*amount])) as Cost;
        if(!cu||!villager||!debit(map,match,seat,cost)){fail('No tenés comida controlada suficiente para entrenar '+amount+' Aldeano(s).');return}
        for(let i=0;i<amount;i++)match.units.push({id:crypto.randomUUID(),seat,q:cu.q,r:cu.r,kind:'Aldeano'});
        match.log.unshift('Jugador '+(seat+1)+' entrenó '+amount+' Aldeano(s)');
      }else if(action==='research'&&phase===1){
        const name=packet.kind??'';
        const allowed=['Telar','Carretilla','Doble Filo','Pastoreo','Rot. de Cultivos','Recolección','Canteros','Minería Imperial','Qanats','Canteros Reales','Explotac. Aurífera','Administración Real','Carreta Mercante'];
        const node=getMatNode(map,seat,name,'tech',player.age);
        if(!allowed.includes(name)||!node||player.techs.includes(name)){fail('Tecnología no disponible en tu Mat o Edad.');return}
        const facility=({mill:'Campamento Productivo',port:'Puerto',barracks:'Cuartel',tower:'Torre'} as Record<string,string>)[node.building];
        if(facility&&!match.buildings.some(b=>b.seat===seat&&b.kind===facility&&control(map,match,seat,b.q,b.r))){
          fail('Necesitás un '+facility+' controlado para investigar '+name+'.');return;
        }
        if(!debit(map,match,seat,node.cost)){fail('Recursos insuficientes en hexágonos controlados.');return}
        player.techs.push(name);match.log.unshift('Jugador '+(seat+1)+' investigó '+name);
      }else if(action==='age'&&phase===2){
        if(player.age>=4){fail('Ya estás en Edad Imperial.');return}
        const cost=ages[player.age];if(!afford(wallet(map,match,seat),cost)){fail('Recursos insuficientes para avanzar de Edad.');return}
        // Requisito móvil: construcción de la Edad, cuando corresponde.
        if(player.age>1&&!match.buildings.some(b=>b.seat===seat&&b.builtAge===player.age)){fail('Necesitás una construcción realizada en tu Edad actual antes de avanzar.');return}
        if(!debit(map,match,seat,cost)){fail('Recursos insuficientes bajo control.');return}
        player.age++;match.log.unshift('Jugador '+(seat+1)+' avanzó a Edad '+player.age);
      }else{
        fail('Acción no disponible en esta fase. Las acciones sin costes definidos se habilitarán cuando estén confirmados.');return;
      }
      if(match.phase===2){match.phase=0;match.turn++;if(match.turn>=map.count){match.turn=0;match.round++}}
      else match.phase=(match.phase+1) as 0|1|2;
      updateWallets(map,match);
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
    if(packet.type==='confirm_cu_position'){
      if(!this.map||!this.map.setupConfirmed||!this.map.started)return;
      const seat=this.seat(ws),placed=this.map.centers??[],order=this.map.order??Array.from({length:this.map.count},(_,i)=>i),draft=this.map.draft;
      if(!draft||draft.seat!==seat||order[placed.length]!==seat)return;
      const next=[...placed,draft];
      this.map.centers=next;this.map.draft=null;
      if(placed.length<2){
        this.map.awaitingVillager=seat;
      }else if(next.length===this.map.count&&!this.map.match)this.map.match=prepareMatch(this.map);
      await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='place_initial_villager'){
      if(!this.map||this.map.awaitingVillager!==this.seat(ws))return;
      const seat=this.seat(ws),cu=this.map.centers?.find(c=>c.seat===seat);
      const chosen={q:packet.q as number,r:packet.r as number};
      const tile=this.map.hexes.find(h=>h.q===chosen.q&&h.r===chosen.r);
      if(!cu||!Number.isInteger(chosen.q)||!Number.isInteger(chosen.r)||!tile||tile.type.startsWith('Agua')||range(cu,chosen)!==1){
        ws.send(JSON.stringify({type:'error',message:'Elegí un hexágono terrestre adyacente a tu Centro Urbano.'}));return;
      }
      this.map.initialVillagers={...(this.map.initialVillagers??{}),[seat]:chosen};
      this.map.awaitingVillager=undefined;
      if(this.map.centers?.length===this.map.count&&!this.map.match)this.map.match=prepareMatch(this.map);
      await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='confirm_cu'){
      if(!this.map||!this.map.setupConfirmed||!this.map.started)return;
      const seat=this.seat(ws),draft=this.map.draft,placed=this.map.centers??[],order=this.map.order??Array.from({length:this.map.count},(_,i)=>i);
      if(!draft||draft.seat!==seat||order[placed.length]!==seat)return;
      if(placed.length<2){
        const chosen={q:packet.q as number,r:packet.r as number};
        const hex=this.map.hexes.find(h=>h.q===chosen.q&&h.r===chosen.r);
        if(!Number.isInteger(chosen.q)||!Number.isInteger(chosen.r)||!hex||hex.type.startsWith('Agua')||range(chosen,draft)!==1){
          ws.send(JSON.stringify({type:'error',message:'Elegí un hexágono terrestre adyacente para tu primer Aldeano.'}));return;
        }
        this.map.initialVillagers={...(this.map.initialVillagers??{}),[seat]:{q:chosen.q,r:chosen.r}};
      }
      this.map.centers=[...placed,draft];this.map.draft=null;
      if(this.map.centers.length===this.map.count&&!this.map.match)this.map.match=prepareMatch(this.map);
      await this.ctx.storage.put('map',this.map);this.broadcast({type:'map',map:this.map});return;
    }
    if(packet.type==='place_cu'){
      if(this.map?.awaitingVillager!==undefined)return;
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
      if(!this.map.hexes.some(h=>range(h,{q:q!,r:r!})===1&&!h.type.startsWith('Agua'))){ws.send(JSON.stringify({type:'error',message:'Tu CU debe tener al menos un terreno terrestre adyacente para los aldeanos iniciales.'}));return}
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
    if(url.pathname==='/api/health')return Response.json({name:'AoE BoardGame Digital',milestone:3,status:'online'});
    if(url.pathname.startsWith('/ws/')){
      const room=url.pathname.slice(4);
      if(!/^[a-zA-Z0-9_-]{3,30}$/.test(room))return new Response('Código de sala inválido',{status:400});
      return env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(room)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
