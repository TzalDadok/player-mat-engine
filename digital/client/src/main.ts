import Phaser from 'phaser';
import './style.css';

const container = document.getElementById('app')!;
container.innerHTML = `
<header><div><strong>AoE BoardGame <span class="tag">Digital · Hito 2</span></strong><br/><small>Cliente web + servidor multijugador</small></div>
<div class="controls"><input id="name" aria-label="Nombre del jugador" maxlength="24" placeholder="Nombre del jugador" value="Jugador"/><button id="join">Entrar a sala</button><button id="fullscreen" class="secondary">⛶ Pantalla completa</button></div><span id="status">Sin conectar</span></header>
<main><section class="stage"><div id="game"></div></section><aside><h2>Sala multijugador</h2><p id="room">Todavía no hay una sala conectada.</p><h2>Jugadores conectados</h2><ol id="players"></ol><hr/><div id="host-config"><div class="controls"><select id="count" aria-label="Jugadores del mapa"><option value="2">2 jugadores</option><option value="3">3 jugadores</option><option value="4">4 jugadores</option></select><button id="generate" disabled>Generar mapa</button></div><button id="confirm-setup" disabled>Confirmar configuración</button></div><div id="game-menu" hidden><h2>Preparación de partida</h2><p>Elegí tu civilización, definí el orden y colocá los Centros Urbanos.</p></div><div class="controls"><label for="civ">Civilización</label><select id="civ"><option value="">Elegí una civilización</option><option value="0">Britones</option><option value="1">Francos</option><option value="2">Vikingos</option><option value="3">Persas</option></select><button id="choose-civ" disabled>Confirmar civilización</button></div><p id="setup-status"></p><button id="start-game" disabled>Iniciar partida</button><p id="map-info">Mapa todavía no generado.</p><div id="order-panel"><h2>Orden de colocación</h2><div id="order-controls"></div><button id="save-order" disabled>Guardar orden</button></div><button id="confirm-cu" disabled>Confirmar posición del CU</button><p id="cu-info">Generá el mapa para colocar los Centros Urbanos.</p><small>Para colocar tu CU, hacé clic en una casilla resaltada del perímetro exterior. Cada jugador dispone de un CU; sus colores corresponden a Britones, Francos, Vikingos y Persas.</small><p>Hito 2: preparación del mapa. Sin turnos ni combate todavía.</p></aside></main>`;

const status = document.getElementById('status')!;
const roomLabel = document.getElementById('room')!;
const players = document.getElementById('players')!;
const join = document.getElementById('join') as HTMLButtonElement;
let socket: WebSocket | undefined;
let playerId = '';
let connectionOpened = false;
let connectionError = '';
const generate = document.getElementById('generate') as HTMLButtonElement;
const mapInfo = document.getElementById('map-info')!;
type Hex = { q:number; r:number; type:string };
type Placement = {seat:number;q:number;r:number};
type MapState = { seed:number; count:number; hexes:Hex[]; centers?:Placement[];order?:number[];civs?:Record<number,number>;started?:boolean;setupConfirmed?:boolean;draft?:Placement|null };
const colors = [0xcc4141,0x3983e4,0x222222,0x42a66a];
const civNames = ['Britones','Francos','Vikingos','Persas'];
const civSelect=document.getElementById('civ') as HTMLSelectElement;
const chooseCiv=document.getElementById('choose-civ') as HTMLButtonElement;
const startGame=document.getElementById('start-game') as HTMLButtonElement;
const setupStatus=document.getElementById('setup-status')!;
const confirmSetup=document.getElementById('confirm-setup') as HTMLButtonElement;
const hostConfig=document.getElementById('host-config')!;
const gameMenu=document.getElementById('game-menu')!;
const confirmCu=document.getElementById('confirm-cu') as HTMLButtonElement;
let mySeat = -1;
let lobbyPlayers: {id:string;name:string;seat:number}[]=[];
const orderControls=document.getElementById('order-controls')!;
const saveOrder=document.getElementById('save-order') as HTMLButtonElement;
function redrawOrder(){
  orderControls.replaceChildren();
  const map=sharedMap;
  if(!map){saveOrder.disabled=true;return}
  const locked=!map.setupConfirmed||!!map.centers?.length||!!map.started;
  const host=mySeat>=0&&mySeat===Math.min(...lobbyPlayers.map(p=>p.seat));
  const order=map.order??Array.from({length:map.count},(_,i)=>i);
  for(let i=0;i<map.count;i++){
    const row=document.createElement('label');row.textContent=(i+1)+'º ';row.className='order-row';
    const select=document.createElement('select');select.dataset.position=String(i);
    for(let s=0;s<map.count;s++){
      const option=document.createElement('option');option.value=String(s);
      option.textContent=lobbyPlayers.find(p=>p.seat===s)?.name??('Jugador '+(s+1));
      select.append(option);
    }
    select.value=String(order[i]);select.disabled=locked||!host;row.append(select);orderControls.append(row);
  }
  saveOrder.disabled=locked||!host;
  // El anfitrión aplica el orden al modificar un selector; los demás lo reciben
  // como nuevo estado del servidor, sin necesidad de recargar sus ventanas.
  orderControls.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{
    const selects=[...orderControls.querySelectorAll('select')];
    const changed=Number((select as HTMLSelectElement).dataset.position);
    const chosen=Number((select as HTMLSelectElement).value);
    const oldOrder=sharedMap?.order??Array.from({length:map.count},(_,i)=>i);
    const previous=oldOrder[changed];
    const other=selects.findIndex((item,i)=>i!==changed&&Number((item as HTMLSelectElement).value)===chosen);
    if(other>=0)(selects[other] as HTMLSelectElement).value=String(previous);
    const updated=selects.map(item=>Number((item as HTMLSelectElement).value));
    if(new Set(updated).size===map.count&&socket?.readyState===WebSocket.OPEN)
      socket.send(JSON.stringify({type:'set_order',order:updated}));
  }));
}
saveOrder.addEventListener('click',()=>{
  const order=[...orderControls.querySelectorAll('select')].map(s=>Number(s.value));
  if(new Set(order).size!==order.length){cuInfo.textContent='Cada jugador debe ocupar una posición distinta.';return}
  socket?.send(JSON.stringify({type:'set_order',order}));
});
const cuInfo = document.getElementById('cu-info')!;
let sharedMap:MapState|null = null;
const roomCodeInput = document.createElement('input');
roomCodeInput.id = 'room-code';
roomCodeInput.placeholder = 'Código de sala';
// Las salas son persistentes: nunca reutilizar un código fijo como predeterminado.
// El parámetro ?sala= permite que los invitados accedan a la misma sala.
const suppliedRoom = new URLSearchParams(location.search).get('sala');
const newRoomCode = () => 'AOE-' + crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
roomCodeInput.value = suppliedRoom || newRoomCode();
document.querySelector('header .controls')!.insertBefore(roomCodeInput, join);
const newRoomButton=document.createElement('button');
newRoomButton.className='secondary';
newRoomButton.textContent='Nueva sala';
newRoomButton.title='Crear un código de sala nuevo sin reutilizar partidas anteriores';
document.querySelector('header .controls')!.insertBefore(newRoomButton, join);
newRoomButton.addEventListener('click',()=>{
  // Nunca borrar el estado de una partida compartida: crear un identificador nuevo.
  const code=newRoomCode();
  location.assign(location.pathname+'?sala='+encodeURIComponent(code));
});

const terrain: Record<string,{fill:number;label:string}> = {
  'Maravilla':{fill:0xc4a45a,label:'🏛️'},
  'Frutos silvestres':{fill:0x668447,label:'🫐'},'Animales':{fill:0x94a35b,label:'🐑'},
  'Cantera de Oro':{fill:0xb39b47,label:'🪙'},'Cantera de Piedra':{fill:0x828993,label:'🪨'},
  'Bosque':{fill:0x386b48,label:'🌲'},'Agua':{fill:0x36759f,label:'🌊'},'Agua A':{fill:0x36759f,label:'A'},'Agua B':{fill:0x36759f,label:'B'},
  'Desierto':{fill:0xc9a26c,label:'🏜️'},'Llanura':{fill:0x85a86a,label:'🌱'},
  'Montaña':{fill:0x6b737c,label:'⛰️'}
};
// Íconos idénticos a los recursos del Player Mat (app.js: R).
const resourceIcons: Record<string,string> = {
  'Frutos silvestres':'🥩',
  'Animales':'🥩',
  'Cantera de Oro':'🪙',
  'Cantera de Piedra':'🪨',
  'Bosque':'🪵'
};
const textures:Record<string,string> = {'Frutos silvestres':'comidaFrutos','Animales':'comidaAnimales','Cantera de Oro':'oro','Cantera de Piedra':'piedra','Bosque':'madera','Desierto':'nadaArena','Llanura':'nadaPasto','Montaña':'montana','Agua A':'aguaA','Agua B':'aguaB','Maravilla':'maravilla','Centro Urbano':'centroUrbano'};
class BootScene extends Phaser.Scene {
  preload(){for(const name of Object.values(textures))this.load.image(name,'/terrenos/'+name+'.webp');}
  private currentMap: MapState|null = null;
  private seat=-1;
  private selectable: {q:number;r:number;polygon:Phaser.Geom.Polygon}[]=[];
  private touchStart: {x:number;y:number}|null=null;
  setSeat(seat:number){this.seat=seat;this.draw()}
  constructor(){super('BootScene')}
  create(){
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
      this.touchStart={x:pointer.x,y:pointer.y};
    });
    this.input.on('pointerup',(pointer:Phaser.Input.Pointer)=>{
      if(!this.touchStart)return;
      const moved=Math.hypot(pointer.x-this.touchStart.x,pointer.y-this.touchStart.y);
      this.touchStart=null;
      if(moved>15||socket?.readyState!==WebSocket.OPEN)return;
      const spot=this.selectable.find(p=>Phaser.Geom.Polygon.Contains(p.polygon,pointer.x,pointer.y));
      if(spot)socket.send(JSON.stringify({type:'place_cu',q:spot.q,r:spot.r}));
    });
    this.scale.on('resize',()=>this.draw());
    this.draw();
  }
  updateMap(map:MapState|null){this.currentMap=map;this.draw()}
  private draw(){
    this.children.removeAll();
    this.selectable=[];
    const width=this.scale.width,height=this.scale.height;
    this.cameras.main.setBackgroundColor('#172635');
    if(!this.currentMap){
      this.add.text(width/2,height/2,'Conectate y generá un mapa', {fontSize:'23px',color:'#f3e5be'}).setOrigin(.5);
      return;
    }
    const hexes=this.currentMap.hexes;
    // Compatibilidad con mapas viejos: la Maravilla debe ser la única ficha en (0,0).
    const displayHexes=[...hexes.filter(h=>h.q!==0||h.r!==0),{q:0,r:0,type:'Maravilla'}];
    const occupied=new Set(displayHexes.map(h=>h.q+','+h.r));
    const centers=this.currentMap.centers??[];
    const draft=this.currentMap.draft;
    const candidates=new Map<string,{q:number;r:number}>();
    const neighborDirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    for(const h of hexes)for(const [dq,dr] of neighborDirs){const q=h.q+dq,r=h.r+dr,key=q+','+r;if(!occupied.has(key))candidates.set(key,{q,r})}
    const spots=[...candidates.values()].filter(p=>!centers.some(center=>Math.max(Math.abs(center.q-p.q),Math.abs(center.r-p.r),Math.abs(center.q+center.r-p.q-p.r))<=1));
    const order=this.currentMap.order??Array.from({length:this.currentMap.count},(_,i)=>i);
    const canPlace=!!this.currentMap.setupConfirmed&&!this.currentMap.started&&Number.isInteger(this.currentMap.civs?.[this.seat])&&this.seat>=0&&this.seat===order[centers.length]&&!centers.some(p=>p.seat===this.seat);
    const allCoords=[...displayHexes,...centers.map(p=>({q:p.q,r:p.r})),...spots].map(({q,r})=>({x:Math.sqrt(3)*(q+r/2),y:1.5*r}));
    const coords=displayHexes.map(({q,r})=>({x:Math.sqrt(3)*(q+r/2),y:1.5*r}));
    const minX=Math.min(...allCoords.map(p=>p.x))-1,maxX=Math.max(...allCoords.map(p=>p.x))+1;
    const minY=Math.min(...allCoords.map(p=>p.y))-1,maxY=Math.max(...allCoords.map(p=>p.y))+1;
    const size=Math.min((width-60)/(maxX-minX),(height-110)/(maxY-minY),55);
    const cx=width/2-size*(minX+maxX)/2,cy=height/2-size*(minY+maxY)/2+20;
    const g=this.add.graphics();
    for(let i=0;i<displayHexes.length;i++){
      const {q,r,type}=displayHexes[i];
      const x=cx+size*coords[i].x,y=cy+size*coords[i].y;
      const points:Phaser.Math.Vector2[]=[];
      for(let k=0;k<6;k++){
        const a=(60*k-30)*Math.PI/180;
        points.push(new Phaser.Math.Vector2(x+size*Math.cos(a),y+size*Math.sin(a)));
      }
      const imageName=textures[type];
      if(imageName && this.textures.exists(imageName)){
        // Ligero solapamiento para compensar el margen transparente y antialiasing del WebP.
        // Bosque y Montaña fueron exportados con el hexágono más angosto
        // (aprox. 380 px vs 444 px de los demás en una textura 512).
        // Compensamos solo el ancho, sin modificar la posición del hexágono.
        const widthCorrection = type === 'Bosque' || type === 'Montaña' ? 1.17 : 1;
        this.add.image(x,y,imageName).setDisplaySize(size*2.055*widthCorrection,size*2.055);
      } else {
        g.fillStyle(terrain[type]?.fill||0x555555);g.fillPoints(points,true);
        g.lineStyle(Math.max(1,size*.035),0x162533);g.strokePoints(points,true);
        this.add.text(x,y,terrain[type]?.label||'?',{fontSize:Math.max(13,Math.round(size*.57))+'px'}).setOrigin(.5);
      }
    }
    // Casillas nuevas permitidas, seleccionables solamente por el jugador sin CU.
    if(canPlace)for(const p of spots){
      const x=cx+size*Math.sqrt(3)*(p.q+p.r/2),y=cy+size*1.5*p.r;
      const polygon:Phaser.Geom.Point[]=[];
      for(let k=0;k<6;k++){const a=(60*k-30)*Math.PI/180;polygon.push(new Phaser.Geom.Point(x+size*.97*Math.cos(a),y+size*.97*Math.sin(a)))}
      const myColor=colors[this.currentMap.civs?.[this.seat]??this.seat];
      const outline=this.add.graphics();outline.fillStyle(myColor,.13);outline.fillPoints(polygon,true);outline.lineStyle(2,myColor,.7);outline.strokePoints(polygon,true);
      // Hit-test único para mouse y touch. No usamos zonas rectangulares
      // superpuestas entre hexágonos, que resultaban difíciles de tocar.
      this.selectable.push({q:p.q,r:p.r,polygon:new Phaser.Geom.Polygon(polygon)});
    }
    for(const p of [...centers,...(draft?[draft]:[])]){
      const x=cx+size*Math.sqrt(3)*(p.q+p.r/2),y=cy+size*1.5*p.r;
      const color=colors[this.currentMap.civs?.[p.seat]??p.seat]??0xffffff;
      const hex:Phaser.Geom.Point[]=[];
      for(let k=0;k<6;k++){const a=(60*k-30)*Math.PI/180;hex.push(new Phaser.Geom.Point(x+size*Math.cos(a),y+size*Math.sin(a)))}
      const border=this.add.graphics();border.fillStyle(color,draft===p?.65:.4);border.fillPoints(hex,true);border.lineStyle(draft===p?4:3,color,1);border.strokePoints(hex,true);
      if(this.textures.exists('centroUrbano'))this.add.image(x,y,'centroUrbano').setDisplaySize(size*1.75,size*1.75);
      this.add.circle(x,y-size*.63,Math.max(8,size*.24),color,1).setStrokeStyle(2,0xffffff);
      this.add.text(x,y-size*.63,String(p.seat+1),{fontSize:Math.max(10,size*.29)+'px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5);
    }
    // Superponer el recurso en el centro de cada hexágono primario.
    // Se hace después de las texturas para que siempre quede visible.
    for(let i=0;i<displayHexes.length;i++){
      const {type}=displayHexes[i];
      const icon=resourceIcons[type];
      if(!icon)continue;
      const x=cx+size*coords[i].x,y=cy+size*coords[i].y;
      const fontSize=Math.max(9,Math.round(size*.32));
      // Más adentro del vértice inferior, con insignia circular de 6 px de margen.
      const iconY=y+size*.57;
      const radius=fontSize*.59+2.5;
      this.add.circle(x,iconY,radius,0x000000,0.55);
      const label=this.add.text(x,iconY,icon,{
        fontSize:fontSize+'px'
      }).setOrigin(.5);
      label.setResolution(2);
    }
    this.add.text(width/2,20,hexes.length+' terrenos + Maravilla · Semilla '+this.currentMap.seed,{fontSize:'15px',color:'#f3e5be'}).setOrigin(.5,0);
  }
}
const game = new Phaser.Game({type: Phaser.AUTO, parent:'game', backgroundColor:'#172635', scale:{mode:Phaser.Scale.RESIZE, width:'100%', height:'100%'}, scene:[BootScene]});
function renderMap(map:MapState|null){
  sharedMap=map;
  const scene=game.scene.getScene('BootScene') as BootScene;
  if(scene.scene.isActive())scene.updateMap(map);
  mapInfo.textContent=map ? map.hexes.length+' terrenos + Maravilla para '+map.count+' jugadores · Semilla '+map.seed : 'Mapa todavía no generado.';
  const countSelect=document.getElementById('count') as HTMLSelectElement;
  if(map)countSelect.value=String(map.count);
  const isHost=mySeat>=0&&lobbyPlayers.length>0&&mySeat===Math.min(...lobbyPlayers.map(p=>p.seat));
  hostConfig.hidden=!!map?.setupConfirmed||!!map?.started;
  gameMenu.hidden=!map?.setupConfirmed;
  confirmSetup.disabled=!isHost||!map||!!map.setupConfirmed;
  countSelect.disabled=!isHost||!!map;
  generate.disabled=!isHost||!!map||socket?.readyState!==WebSocket.OPEN;
  const chosen=map?.civs??{};
  civSelect.disabled=!map||!!map.started || (map.centers??[]).some(p=>p.seat===mySeat);
  if(map&&Number.isInteger(chosen[mySeat]))civSelect.value=String(chosen[mySeat]);
  Array.from(civSelect.options).forEach(o=>{if(o.value!=='')o.disabled=Object.entries(chosen).some(([s,v])=>Number(s)!==mySeat&&String(v)===o.value)});
  chooseCiv.disabled=!map||!map.setupConfirmed||!!map.started||mySeat<0||mySeat>=map.count||civSelect.value===''||civSelect.disabled;
  const complete=!!map&&lobbyPlayers.length===map.count&&Array.from({length:map.count},(_,i)=>i).every(seat=>Number.isInteger(chosen[seat])&&(map.centers??[]).some(p=>p.seat===seat))&&new Set(Object.values(chosen)).size===map.count;
  startGame.disabled=!isHost||!complete||!!map?.started;
  confirmCu.disabled=!map?.setupConfirmed||map.draft?.seat!==mySeat;
  confirmCu.hidden=!map?.draft||map.draft.seat!==mySeat;
  setupStatus.textContent=!map?'Paso 1: elegí la cantidad de jugadores y generá el mapa.':map.started?'Partida iniciada.':'Paso 2: elegí tu civilización. Jugadores '+lobbyPlayers.length+'/'+map.count+' · Civilizaciones '+Object.keys(chosen).length+'/'+map.count+' · CU '+(map.centers?.length??0)+'/'+map.count;
  const placed=map?.centers??[];
  redrawOrder();
  const order=map?.order??Array.from({length:map?.count??0},(_,i)=>i);
  const next=order[placed.length];
  const nextName=lobbyPlayers.find(p=>p.seat===next)?.name??('Jugador '+(next+1));
  cuInfo.textContent=!map?'Generá el mapa para colocar los CU.':!map.setupConfirmed?'El anfitrión debe confirmar la configuración.':map.draft?.seat===mySeat?'Podés tocar otro hexágono para mover tu CU provisional o confirmar la posición.':mySeat<0?'Conectate para colocar tu CU.':mySeat>=map.count?'Estás como espectador: no hay puesto disponible.':placed.length>=map.count?'Todos los CU están colocados.':placed.some(p=>p.seat===mySeat)?'Tu CU está colocado. Ahora le toca a '+nextName+'.':mySeat!==next?'Turno de '+nextName+' para colocar su CU.': 'Es tu turno. Elegí una casilla exterior resaltada sin CU vecinos ('+placed.length+'/'+map.count+' colocados).';
}
confirmSetup.addEventListener('click',()=>{if(sharedMap&&!sharedMap.setupConfirmed&&window.confirm('¿Confirmás la configuración de '+sharedMap.count+' jugadores y el mapa generado?'))socket?.send(JSON.stringify({type:'confirm_setup'}))});
confirmCu.addEventListener('click',()=>socket?.send(JSON.stringify({type:'confirm_cu'})));
generate.addEventListener('click',()=>socket?.send(JSON.stringify({type:'generate',count:Number((document.getElementById('count') as HTMLSelectElement).value)})));
civSelect.addEventListener('change',()=>{if(sharedMap)renderMap(sharedMap)});
chooseCiv.addEventListener('click',()=>{if(civSelect.value!=='')socket?.send(JSON.stringify({type:'choose_civ',civ:Number(civSelect.value)}))});
startGame.addEventListener('click',()=>socket?.send(JSON.stringify({type:'start_game'})));
document.getElementById('fullscreen')!.addEventListener('click', async () => {
  if (!document.fullscreenElement) await document.body.requestFullscreen();
  else await document.exitFullscreen();
});
join.addEventListener('click', () => {
  if (socket) return;
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    status.textContent = 'Código de sala inválido'; return;
  }
  const name = (document.getElementById('name') as HTMLInputElement).value.trim() || 'Jugador';
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}`);
  socket = ws;
  connectionOpened = false;
  connectionError = '';
  join.disabled = true;
  status.textContent = 'Conectando…';
  ws.onopen = () => {
    connectionOpened = true;
    status.textContent = 'Conectado';
    renderMap(sharedMap);
    roomLabel.textContent = 'Sala: ' + code;
    history.replaceState(null, '', '?sala=' + encodeURIComponent(code));
  };
  ws.onmessage = event => {
    try {
      const packet = JSON.parse(String(event.data));
      if (packet.type === 'welcome') { playerId = packet.id; mySeat=packet.seat; (game.scene.getScene('BootScene') as BootScene).setSeat(mySeat); renderMap(sharedMap); }
      if (packet.type === 'seat') {mySeat=packet.seat;(game.scene.getScene('BootScene') as BootScene).setSeat(mySeat);renderMap(sharedMap)}
      if (packet.type === 'map') renderMap(packet.map);
      if (packet.type === 'error') mapInfo.textContent = packet.message;
      if (packet.type === 'lobby') {
        lobbyPlayers=packet.players;
        renderMap(sharedMap);
        players.replaceChildren(...packet.players.map((p: { id: string; name: string }) => {
          const li = document.createElement('li');
          li.textContent = p.name + (p.id === playerId ? ' (vos)' : '');
          return li;
        }));
      }
    } catch { /* ignore malformed payload */ }
  };
  ws.onerror = () => {
    connectionError = 'No fue posible establecer WebSocket con Cloudflare.';
    status.textContent = 'Error de conexión';
    roomLabel.textContent = connectionError;
  };
  ws.onclose = (event) => {
    const wasOpen = connectionOpened;
    const errorText = connectionError;
    connectionOpened = false;
    socket = undefined;
    playerId = '';
    mySeat=-1;
    (game.scene.getScene('BootScene') as BootScene).setSeat(-1);
    join.disabled = false;
    generate.disabled = true;
    (document.getElementById('count') as HTMLSelectElement).disabled=true;
    status.textContent = wasOpen ? 'Desconectado' : 'No se pudo conectar';
    roomLabel.textContent = wasOpen ? 'Conexión cerrada: ' + (event.reason || event.code) : (errorText || 'La conexión se cerró antes de abrir (código ' + event.code + ').');
    lobbyPlayers=[];
    players.replaceChildren();
    renderMap(sharedMap);
  };
});
window.addEventListener('beforeunload', () => socket?.close());
