import Phaser from 'phaser';
import './style.css';

const container = document.getElementById('app')!;
container.innerHTML = `
<header><div><strong>AoE BoardGame <span class="tag">Digital · Hito 2</span></strong><br/><small>Cliente web + servidor multijugador</small></div>
<div class="controls"><input id="name" aria-label="Nombre del jugador" maxlength="24" placeholder="Nombre del jugador" value="Jugador"/><button id="join">Entrar a sala</button><button id="fullscreen" class="secondary">⛶ Pantalla completa</button></div><span id="status">Sin conectar</span></header>
<main><section class="stage"><div id="game"></div></section><aside><h2 id="phase-title">Crear partida</h2><p id="room">Sin conectar</p>
<div id="host-config"><div class="controls"><select id="count"><option value="2">2 jugadores</option><option value="3">3 jugadores</option><option value="4">4 jugadores</option></select><button id="generate" disabled>Generar mapa</button></div></div>
<div id="lobby-panel" hidden><p id="setup-status"></p><div class="lobby-scroll"><table class="lobby-table"><thead><tr><th>JUGADOR</th><th>CIVILIZACIÓN</th><th>ORDEN</th><th>READY</th></tr></thead><tbody id="lobby-rows"></tbody></table></div><button id="start-game" disabled>Iniciar partida</button></div>
<div id="cu-panel" hidden><p id="cu-info"></p><button id="confirm-cu" disabled>Confirmar posición del CU</button></div>
<div id="recovery-panel" hidden><h3>Recuperar tu jugador</h3><p>Guardá este código privado para regresar desde otro navegador o celular.</p><div class="controls"><input id="recovery-code" aria-label="Tu código de recuperación" readonly/><button id="copy-recovery" class="secondary">Copiar</button></div><small>Compartir este código permite controlar tu jugador. Conservá también el código de sala.</small></div>
<div id="playing-panel" hidden><p>Todos los CU colocados. El menú de partida se incorporará en el Hito 3.</p></div><p id="map-info">Mapa todavía no generado.</p>
</aside></main>`;

const status = document.getElementById('status')!;
const roomLabel = document.getElementById('room')!;
const players = document.createElement('ol');
const join = document.getElementById('join') as HTMLButtonElement;
const recoveryPanel=document.getElementById('recovery-panel')!;
const recoveryCode=document.getElementById('recovery-code') as HTMLInputElement;
const copyRecovery=document.getElementById('copy-recovery') as HTMLButtonElement;
copyRecovery.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(recoveryCode.value);copyRecovery.textContent='Copiado'}catch{recoveryCode.select();copyRecovery.textContent='Seleccioná y copiá'}
});
let socket: WebSocket | undefined;
let playerId = '';
let connectionOpened = false;
let connectionError = '';
const generate = document.getElementById('generate') as HTMLButtonElement;
const mapInfo = document.getElementById('map-info')!;
type Hex = { q:number; r:number; type:string };
type Placement = {seat:number;q:number;r:number};
type MapState = { seed:number; count:number; hexes:Hex[]; centers?:Placement[];order?:number[];civs?:Record<number,number>;started?:boolean;setupConfirmed?:boolean;draft?:Placement|null;ready?:Record<number,boolean> };
const colors = [0xcc4141,0x3983e4,0x222222,0x42a66a];
const civNames = ['Britones','Francos','Vikingos','Persas'];
const startGame=document.getElementById('start-game') as HTMLButtonElement;
const setupStatus=document.getElementById('setup-status')!;
const hostConfig=document.getElementById('host-config')!;
const lobbyPanel=document.getElementById('lobby-panel')!;
const cuPanel=document.getElementById('cu-panel')!;
const playingPanel=document.getElementById('playing-panel')!;
const phaseTitle=document.getElementById('phase-title')!;
const lobbyRows=document.getElementById('lobby-rows')!;
const confirmCu=document.getElementById('confirm-cu') as HTMLButtonElement;
const cuInfo=document.getElementById('cu-info')!;
let mySeat=-1;
let lobbyPlayers:{id:string;name:string;seat:number}[]=[];
let sharedMap:MapState|null=null;
function renderLobby(){
  lobbyRows.replaceChildren();
  const map=sharedMap;if(!map)return;
  const order=map.order??Array.from({length:map.count},(_,i)=>i);
  const civs=map.civs??{},ready=map.ready??{};
  for(let seat=0;seat<map.count;seat++){
    const tr=document.createElement('tr');
    const name=document.createElement('td');name.textContent=lobbyPlayers.find(p=>p.seat===seat)?.name??'Esperando…';
    const civCell=document.createElement('td'),select=document.createElement('select');
    const blank=document.createElement('option');blank.value='';blank.textContent='Elegir…';select.append(blank);
    for(let i=0;i<civNames.length;i++){const o=document.createElement('option');o.value=String(i);o.textContent=civNames[i];o.disabled=Object.entries(civs).some(([s,v])=>Number(s)!==seat&&v===i);select.append(o)}
    select.value=Number.isInteger(civs[seat])?String(civs[seat]):'';
    select.disabled=seat!==mySeat||ready[seat]===true||!lobbyPlayers.some(p=>p.seat===seat);
    select.addEventListener('change',()=>{if(select.value!=='')socket?.send(JSON.stringify({type:'choose_civ',civ:Number(select.value)}))});civCell.append(select);
    const orderCell=document.createElement('td'),pos=document.createElement('select');
    for(let i=0;i<map.count;i++){const o=document.createElement('option');o.value=String(i);o.textContent=String(i+1);pos.append(o)}
    pos.value=String(order.indexOf(seat));pos.disabled=mySeat!==0||Object.values(ready).some(Boolean);
    pos.addEventListener('change',()=>{const updated=[...order],old=updated.indexOf(seat),target=Number(pos.value);[updated[old],updated[target]]=[updated[target],updated[old]];socket?.send(JSON.stringify({type:'set_order',order:updated}))});orderCell.append(pos);
    const readyCell=document.createElement('td'),check=document.createElement('input');check.type='checkbox';check.checked=ready[seat]===true;check.disabled=seat!==mySeat||!Number.isInteger(civs[seat]);check.addEventListener('change',()=>socket?.send(JSON.stringify({type:'set_ready',ready:check.checked})));readyCell.append(check);
    tr.append(name,civCell,orderCell,readyCell);lobbyRows.append(tr);
  }
}
const roomCodeInput = document.createElement('input');
roomCodeInput.id = 'room-code';
roomCodeInput.placeholder = 'Código de sala';
// Las salas son persistentes: nunca reutilizar un código fijo como predeterminado.
// El parámetro ?sala= permite que los invitados accedan a la misma sala.
const suppliedRoom = new URLSearchParams(location.search).get('sala');
const newRoomCode = () => 'AOE-' + crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
roomCodeInput.value = suppliedRoom || newRoomCode();
document.querySelector('header .controls')!.insertBefore(roomCodeInput, join);
const restoreInput=document.createElement('input');
restoreInput.placeholder='Código de recuperación (opcional)';
restoreInput.title='Para recuperar tu jugador desde otro dispositivo';
restoreInput.autocomplete='off';
document.querySelector('header .controls')!.insertBefore(restoreInput,join);
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
    const canPlace=!!this.currentMap.started&&Number.isInteger(this.currentMap.civs?.[this.seat])&&this.seat>=0&&this.seat===order[centers.length]&&!centers.some(p=>p.seat===this.seat);
    // Centrar todo lo visible y aprovechar al máximo el tamaño del canvas.
    // Los candidatos exteriores solo cuentan cuando están visibles para este jugador.
    const shown=[...displayHexes,...centers,...(draft?[draft]:[]),...(canPlace?spots:[])];
    const allCoords=shown.map(({q,r})=>({x:Math.sqrt(3)*(q+r/2),y:1.5*r}));
    const coords=displayHexes.map(({q,r})=>({x:Math.sqrt(3)*(q+r/2),y:1.5*r}));
    const minX=Math.min(...allCoords.map(p=>p.x)),maxX=Math.max(...allCoords.map(p=>p.x));
    const minY=Math.min(...allCoords.map(p=>p.y)),maxY=Math.max(...allCoords.map(p=>p.y));
    const margin=Math.min(22,Math.max(8,Math.min(width,height)*.035));
    const topReserve=38;
    const size=Math.max(1,Math.min((width-2*margin)/(maxX-minX+2),(height-topReserve-2*margin)/(maxY-minY+2)));
    const cx=width/2-size*(minX+maxX)/2;
    const cy=(height+topReserve)/2-size*(minY+maxY)/2;
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
      const border=this.add.graphics();border.fillStyle(color, draft === p ? 0.65 : 0.4);border.fillPoints(hex,true);border.lineStyle(draft===p?4:3,color,1);border.strokePoints(hex,true);
      // Usar la misma escala que los hexágonos del terreno. Antes el CU
      // se dibujaba a 1.75 radios frente a 2.055, dejando una separación visible.
      if(this.textures.exists('centroUrbano'))this.add.image(x,y,'centroUrbano').setDisplaySize(size*2.055,size*2.055);
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
  recoveryPanel.hidden=!socket||socket.readyState!==WebSocket.OPEN||mySeat<0;
  const scene=game.scene.getScene('BootScene') as BootScene;
  if(scene.scene.isActive())scene.updateMap(map);
  mapInfo.textContent=map?map.hexes.length+' terrenos + Maravilla · '+map.count+' jugadores':'Mapa todavía no generado.';
  const placed=map?.centers??[],inPlacement=!!map?.started&&placed.length<map.count;
  hostConfig.hidden=!!map||mySeat!==0;
  lobbyPanel.hidden=!map||!!map.started;
  cuPanel.hidden=!inPlacement;
  playingPanel.hidden=!map?.started||inPlacement;
  phaseTitle.textContent=!map?'Crear partida':!map.started?'Sala de espera':inPlacement?'Colocación de CU':'Partida';
  const count=document.getElementById('count') as HTMLSelectElement;
  count.disabled=!!map||mySeat!==0;if(map)count.value=String(map.count);
  generate.disabled=!!map||mySeat!==0||socket?.readyState!==WebSocket.OPEN;
  const ready=map?.ready??{},civs=map?.civs??{};
  const allReady=!!map&&lobbyPlayers.length===map.count&&Array.from({length:map.count},(_,seat)=>seat).every(seat=>lobbyPlayers.some(p=>p.seat===seat)&&ready[seat]===true&&Number.isInteger(civs[seat]))&&new Set(Object.values(civs)).size===map.count;
  startGame.disabled=mySeat!==0||!allReady;
  setupStatus.textContent=map?'Jugadores '+lobbyPlayers.length+'/'+map.count+' · Ready '+Object.values(ready).filter(Boolean).length+'/'+map.count:'';
  renderLobby();
  const order=map?.order??[],next=order[placed.length],nextName=lobbyPlayers.find(p=>p.seat===next)?.name??'Jugador '+(next+1);
  cuInfo.textContent=!inPlacement?'':map?.draft?.seat===mySeat?'Tocá otra casilla para mover tu CU o confirmá la posición.':next===mySeat?'Es tu turno para colocar el CU.':'Turno de '+nextName+'.';
  confirmCu.hidden=map?.draft?.seat!==mySeat;confirmCu.disabled=map?.draft?.seat!==mySeat;
}
confirmCu.addEventListener('click',()=>socket?.send(JSON.stringify({type:'confirm_cu'})));
generate.addEventListener('click',()=>socket?.send(JSON.stringify({type:'generate',count:Number((document.getElementById('count') as HTMLSelectElement).value)})));
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
  // Identidad estable por sala para recuperar civilización, orden y CU.
  const tokenKey='aoe-player-'+code;
  const suppliedToken=restoreInput.value.trim();
  if(suppliedToken&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(suppliedToken)){
    status.textContent='Código de recuperación inválido';return;
  }
  const token=suppliedToken||localStorage.getItem(tokenKey)||crypto.randomUUID();
  const ws = new WebSocket(`${protocol}//${location.host}/ws/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}&token=${encodeURIComponent(token)}`);
  socket = ws;
  recoveryCode.value=token;
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
      if (packet.type === 'welcome') { localStorage.setItem(tokenKey,token);restoreInput.value='';recoveryCode.value=token;playerId = packet.id; mySeat=packet.seat; (game.scene.getScene('BootScene') as BootScene).setSeat(mySeat); renderMap(sharedMap); }
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
    recoveryPanel.hidden=true;
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
