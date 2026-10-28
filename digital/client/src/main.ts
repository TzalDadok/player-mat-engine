import Phaser from 'phaser';
import matData from '../../worker/src/mats.generated.json';
import './style.css';

const container = document.getElementById('app')!;
container.innerHTML = `
<header><div><strong>AoE BoardGame <span class="tag">Digital · Hito 3</span></strong><br/><small>Cliente web + servidor multijugador</small></div>
<div class="controls"><input id="name" aria-label="Nombre del jugador" maxlength="24" placeholder="Nombre del jugador" value="Jugador"/><button id="join">Entrar a sala</button><button id="fullscreen" class="secondary">⛶ Pantalla completa</button></div><span id="status">Sin conectar</span></header>
<main><section class="stage"><div id="game"></div></section><aside><button id="close-panel" class="secondary" type="button" aria-label="Cerrar panel">✕</button><h2 id="phase-title">Crear partida</h2><p id="room">Sin conectar</p>
<div id="host-config"><div class="controls"><select id="count"><option value="2">2 jugadores</option><option value="3">3 jugadores</option><option value="4">4 jugadores</option></select><button id="generate" disabled>Generar mapa</button></div></div>
<div id="lobby-panel" hidden><p id="setup-status"></p><div class="lobby-scroll"><table class="lobby-table"><thead><tr><th>JUGADOR</th><th>CIVILIZACIÓN</th><th>ORDEN</th><th>READY</th></tr></thead><tbody id="lobby-rows"></tbody></table></div><button id="start-game" disabled>Iniciar partida</button></div>
<div id="cu-panel" hidden><p id="cu-info"></p><button id="confirm-cu" disabled>Confirmar posición del CU</button></div>
<div id="recovery-panel" hidden><h3>Recuperar tu jugador</h3><p>Guardá este código privado para regresar desde otro navegador o celular.</p><div class="controls"><input id="recovery-code" aria-label="Tu código de recuperación" readonly/><button id="copy-recovery" class="secondary">Copiar</button></div><small>Compartir este código permite controlar tu jugador. Conservá también el código de sala.</small></div>
<div id="playing-panel" hidden>
<h2>Partida en curso</h2>
<p id="turn-status"></p>
<div id="resources"></div>
<p id="power-status"></p>
<div class="controls"><button id="action-produce">Producir</button><button id="action-move">Mover aldeano</button><button id="action-build">Construir</button><button id="action-trade">Comerciar</button><button id="action-train">Entrenar aldeano</button><button id="action-tech">Investigar</button><button id="action-age">Avanzar Edad</button><button id="action-pass" class="secondary">Pasar fase</button></div>
<p id="action-help">Seleccioná una acción para comenzar.</p><div id="unit-list"></div>
<div id="selected-hexes"></div><p id="hex-info">Tocá un hexágono para ver sus detalles.</p>
<div id="train-panel" hidden><label for="train-amount">Cantidad de aldeanos</label><input id="train-amount" type="number" min="1" step="1" value="1"/></div>
<div id="carry-panel" hidden><label>Carretilla: transportar fichas de recursos</label>
<select id="carry-resource"><option value="food">Comida</option><option value="wood">Madera</option><option value="stone">Piedra</option><option value="gold">Oro</option></select>
<input id="carry-amount" type="number" value="0" min="0" step="1" aria-label="Cantidad transportada"/>
</div><div id="action-options" hidden><label for="action-kind">Elegí una opción:</label><select id="action-kind"></select><div id="trade-fields" hidden><select id="trade-side"><option value="buy">Comprar</option><option value="sell">Vender</option></select><select id="trade-amount"><option value="1">1 recurso</option><option value="2">2 recursos</option></select></div></div><button id="submit-action" hidden>Confirmar acción</button>
<h3>Registro de turnos</h3><ol id="game-log"></ol>
</div><p id="map-info">Mapa todavía no generado.</p>
</aside></main><button id="open-panel" class="secondary" type="button" hidden>☰ Acciones</button>`;

const status = document.getElementById('status')!;
const panel=document.querySelector('aside') as HTMLElement;
const openPanel=document.getElementById('open-panel') as HTMLButtonElement;
const closePanel=document.getElementById('close-panel') as HTMLButtonElement;
let panelDismissed=false;
function setPanelVisible(visible:boolean){panelDismissed=!visible;panel.classList.toggle('collapsed',!visible);openPanel.hidden=visible;}
openPanel.addEventListener('click',()=>setPanelVisible(true));
closePanel.addEventListener('click',()=>setPanelVisible(false));
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
type Unit={id:string;seat:number;q:number;r:number;kind:string};
type Match={round:number;turn:number;phase:number;players:Record<number,{age:number;pm:number;resources:Record<string,number>;techs:string[]}>;units:Unit[];buildings:{seat:number;q:number;r:number;kind:string}[];log:string[];market:Record<string,number>;stock:Record<string,Record<string,number>>};
type MapState = {match?:Match; seed:number; count:number; hexes:Hex[]; centers?:Placement[];order?:number[];civs?:Record<number,number>;started?:boolean;setupConfirmed?:boolean;draft?:Placement|null;ready?:Record<number,boolean> };
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
const turnStatus=document.getElementById('turn-status')!;
const resourcesDisplay=document.getElementById('resources')!;
const powerStatus=document.getElementById('power-status')!;
const actionHelp=document.getElementById('action-help')!;
const unitList=document.getElementById('unit-list')!;
const selectedDisplay=document.getElementById('selected-hexes')!;
const hexInfo=document.getElementById('hex-info')!;
let inspectedHex:{q:number;r:number}|null=null;
const submitAction=document.getElementById('submit-action') as HTMLButtonElement;
const logDisplay=document.getElementById('game-log')!;
let actionMode:'produce'|'move'|'build'|'train'|'research'|'age'|'trade'|null=null;
const optionsPanel=document.getElementById('action-options')!;
const optionSelect=document.getElementById('action-kind') as HTMLSelectElement;
optionSelect.addEventListener('change',()=>renderMap(sharedMap));
const tradeFields=document.getElementById('trade-fields')!;
const carryPanel=document.getElementById('carry-panel')!;
const trainPanel=document.getElementById('train-panel')!;
const carryResource=document.getElementById('carry-resource') as HTMLSelectElement;
const carryAmount=document.getElementById('carry-amount') as HTMLInputElement;
let selectedHexes:{q:number;r:number}[]=[];
let selectedUnits:string[]=[];
type MovePlan={unit:string;q:number;r:number;cargo:Record<string,number>};
let movePlans:MovePlan[]=[];
const resourceTypes=['food','wood','stone','gold'] as const;
function sendAction(data:Record<string,unknown>){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'game_action',...data}))}
document.getElementById('action-produce')!.addEventListener('click',()=>{actionMode='produce';selectedHexes=[];renderMap(sharedMap)});
document.getElementById('action-move')!.addEventListener('click',()=>{actionMode='move';selectedHexes=[];selectedUnits=[];movePlans=[];renderMap(sharedMap)});
for(const [id,action] of [['action-build','build'],['action-trade','trade'],['action-train','train'],['action-tech','research'],['action-age','age']] as const)
  document.getElementById(id)!.addEventListener('click',()=>{actionMode=action;selectedHexes=[];renderMap(sharedMap)});
document.getElementById('action-pass')!.addEventListener('click',()=>sendAction({action:'pass'}));
submitAction.addEventListener('click',()=>{
  if(actionMode==='produce')sendAction({action:'produce',hexes:selectedHexes});
  if(actionMode==='move'&&movePlans.length)sendAction({action:'move',moves:movePlans});
  if(actionMode==='build'&&selectedHexes.length)sendAction({action:'build',kind:optionSelect.value,...selectedHexes[0]});
  if(actionMode==='research')sendAction({action:'research',kind:optionSelect.value});
  if(actionMode==='train')sendAction({action:'train',amount:Number((document.getElementById('train-amount') as HTMLInputElement).value)});
  if(actionMode==='age')sendAction({action:'age'});
  if(actionMode==='trade')sendAction({action:'trade',kind:optionSelect.value,side:(document.getElementById('trade-side') as HTMLSelectElement).value,amount:Number((document.getElementById('trade-amount') as HTMLSelectElement).value)});
});
function selectBoardHex(q:number,r:number){
  inspectedHex={q,r};
  if(!sharedMap?.match||mySeat!==(sharedMap.order??[])[sharedMap.match.turn]||!actionMode){renderMap(sharedMap);return}
  if(actionMode==='produce'){
    const idx=selectedHexes.findIndex(p=>p.q===q&&p.r===r);
    if(idx>=0)selectedHexes.splice(idx,1);
    else if(selectedHexes.length<[2,3,3,4][sharedMap.match.players[mySeat].age-1])selectedHexes.push({q,r});
  }
  if(actionMode==='move'&&selectedUnits[0]){
    const unit=sharedMap.match.units.find(u=>u.id===selectedUnits[0]);
    if(unit&&Math.max(Math.abs(unit.q-q),Math.abs(unit.r-r),Math.abs(unit.q+unit.r-q-r))===1){
      const prior=movePlans.findIndex(p=>p.unit===unit.id);
      const planned:MovePlan={unit:unit.id,q,r,cargo:prior>=0?movePlans[prior].cargo:{food:0,wood:0,stone:0,gold:0}};
      if(prior>=0)movePlans[prior]=planned;else if(movePlans.length<2)movePlans.push(planned);
      selectedUnits=[];
    }
  }
  if(actionMode==='build')selectedHexes=[{q,r}];
  renderMap(sharedMap);
}

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
  private boardTiles:{q:number;r:number;polygon:Phaser.Geom.Polygon}[]=[];
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
      if(spot){socket.send(JSON.stringify({type:'place_cu',q:spot.q,r:spot.r}));return}
      if(this.currentMap?.match){
        const pos=this.boardTiles.find(p=>Phaser.Geom.Polygon.Contains(p.polygon,pointer.x,pointer.y));
        if(pos)selectBoardHex(pos.q,pos.r);
      }
    });
    this.scale.on('resize',()=>this.draw());
    this.draw();
  }
  updateMap(map:MapState|null){this.currentMap=map;this.draw()}
  private draw(){
    this.children.removeAll();
    this.selectable=[];
    this.boardTiles=[];
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
    const spots=[...candidates.values()].filter(p=>!centers.some(center=>Math.max(Math.abs(center.q-p.q),Math.abs(center.r-p.r),Math.abs(center.q+center.r-p.q-p.r))<=1)&&hexes.some(h=>Math.max(Math.abs(h.q-p.q),Math.abs(h.r-p.r),Math.abs(h.q+h.r-p.q-p.r))===1&&!h.type.startsWith('Agua')));
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
      this.boardTiles.push({q,r,polygon:new Phaser.Geom.Polygon(points.map(p=>new Phaser.Geom.Point(p.x,p.y)))});
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
      this.boardTiles.push({q:p.q,r:p.r,polygon:new Phaser.Geom.Polygon(hex)});
      const border=this.add.graphics();border.fillStyle(color, draft === p ? 0.65 : 0.4);border.fillPoints(hex,true);border.lineStyle(draft===p?4:3,color,1);border.strokePoints(hex,true);
      // Usar la misma escala que los hexágonos del terreno. Antes el CU
      // se dibujaba a 1.75 radios frente a 2.055, dejando una separación visible.
      if(this.textures.exists('centroUrbano'))this.add.image(x,y,'centroUrbano').setDisplaySize(size*2.055,size*2.055);
      this.add.circle(x,y-size*.63,Math.max(8,size*.24),color,1).setStrokeStyle(2,0xffffff);
      this.add.text(x,y-size*.63,String(p.seat+1),{fontSize:Math.max(10,size*.29)+'px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5);
    }
    if(this.currentMap.match){
      for(const building of this.currentMap.match.buildings){
        const x=cx+size*Math.sqrt(3)*(building.q+building.r/2),y=cy+size*1.5*building.r;
        const marker=building.kind==='Granja'?'🌾':building.kind==='Cuartel'?'⚔️':building.kind==='Torre'?'🏰':building.kind==='Puerto'?'⚓':'⛏️';
        this.add.text(x+size*.38,y-size*.38,marker,{fontSize:Math.max(12,size*.38)+'px'}).setOrigin(.5);
      }
      const groups=new Map<string,{unit:Unit;count:number}>();
      for(const unit of this.currentMap.match.units){
        const id=unit.seat+','+unit.q+','+unit.r;
        const existing=groups.get(id);
        if(existing)existing.count++;
        else groups.set(id,{unit,count:1});
      }
      for(const {unit,count} of groups.values()){
        const x=cx+size*Math.sqrt(3)*(unit.q+unit.r/2)+(unit.seat-1.5)*size*.1;
        const y=cy+size*1.5*unit.r;
        const color=colors[this.currentMap.civs?.[unit.seat]??unit.seat]??0xffffff;
        this.add.circle(x,y,Math.max(9,size*.31),color,.95).setStrokeStyle(2,0xffffff);
        this.add.text(x,y,count>1?'A'+count:'A',{fontSize:Math.max(11,size*(count>1?.25:.32))+'px',fontStyle:'bold',color:'#ffffff'}).setOrigin(.5);
      }
      const match=this.currentMap.match;
      if(this.seat===(this.currentMap.order??[])[match.turn]&&match.phase===0&&actionMode){
        const own=match.units.filter(u=>u.seat===this.seat);
        for(const tile of hexes){
          const workers=own.filter(u=>u.q===tile.q&&u.r===tile.r).length;
          const camp=match.buildings.some(b=>b.seat===this.seat&&b.q===tile.q&&b.r===tile.r&&b.kind==='Campamento Productivo');
          const farm=match.buildings.some(b=>b.seat===this.seat&&b.q===tile.q&&b.r===tile.r&&b.kind==='Granja');
          const coastal=neighborDirs.some(([dq,dr])=>hexes.some(h=>h.q===tile.q+dq&&h.r===tile.r+dr&&h.type.startsWith('Agua')));
          let eligible=false;
          if(actionMode==='produce')eligible=(workers>0||camp)&&(!!resourceIcons[tile.type]||(farm&&workers>0)||(coastal&&workers>0));
          if(actionMode==='move'){
            const current=own.find(u=>u.id===selectedUnits[0]);
            eligible=!!current&&Math.max(Math.abs(current.q-tile.q),Math.abs(current.r-tile.r),Math.abs(current.q+current.r-tile.q-tile.r))===1&&!tile.type.startsWith('Agua')&&!match.units.some(u=>u.seat!==this.seat&&u.q===tile.q&&u.r===tile.r);
          }
          if(actionMode==='build'){
            const kind=optionSelect.value;
            const adjacentWorker=own.some(u=>Math.max(Math.abs(u.q-tile.q),Math.abs(u.r-tile.r),Math.abs(u.q+u.r-tile.q-tile.r))===1);
            eligible=kind==='Puerto'?tile.type.startsWith('Agua')&&adjacentWorker&&!match.buildings.some(b=>b.q===tile.q&&b.r===tile.r):
              workers>0&&(kind==='Campamento Productivo'?!!resourceIcons[tile.type]&&!camp:
              kind==='Granja'?tile.type==='Llanura'&&match.buildings.filter(b=>b.q===tile.q&&b.r===tile.r&&b.kind==='Granja').length<2:
              ['Llanura','Desierto'].includes(tile.type)&&!match.buildings.some(b=>b.q===tile.q&&b.r===tile.r));
          }
          if(!eligible)continue;
          const x=cx+size*Math.sqrt(3)*(tile.q+tile.r/2),y=cy+size*1.5*tile.r;
          const outline:Phaser.Geom.Point[]=[];
          for(let k=0;k<6;k++){const a=(60*k-30)*Math.PI/180;outline.push(new Phaser.Geom.Point(x+size*.91*Math.cos(a),y+size*.91*Math.sin(a)))}
          const g=this.add.graphics();
          g.lineStyle(Math.max(2,size*.045),0x5cdbbb,.9);g.strokePoints(outline,true);
        }
      }
      for(const tile of selectedHexes){
        const x=cx+size*Math.sqrt(3)*(tile.q+tile.r/2),y=cy+size*1.5*tile.r;
        this.add.circle(x,y,Math.max(10,size*.4),0xffde62,.3).setStrokeStyle(3,0xffde62);
      }
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
  if(map?.match&&!panelDismissed&&mySeat===(map.order??[])[map.match.turn]&&!actionMode)setPanelVisible(true);
  mapInfo.textContent=map?map.hexes.length+' terrenos + Maravilla · '+map.count+' jugadores':'Mapa todavía no generado.';
  const placed=map?.centers??[],inPlacement=!!map?.started&&placed.length<map.count;
  hostConfig.hidden=!!map||mySeat!==0;
  lobbyPanel.hidden=!map||!!map.started;
  cuPanel.hidden=!inPlacement;
  playingPanel.hidden=!map?.match;
  if(map?.match){
    const m=map.match,seat=(map.order??[])[m.turn],active=mySeat===seat,me=m.players[mySeat];
    turnStatus.textContent='Ronda '+m.round+' · '+(lobbyPlayers.find(p=>p.seat===seat)?.name??'Jugador '+(seat+1))+' · Fase '+['Económica','Tecnológica','Militar'][m.phase]+(active?' (tu turno)':'');
    resourcesDisplay.textContent=me?'🥩 '+me.resources.food+' · 🪵 '+me.resources.wood+' · 🪨 '+me.resources.stone+' · 🪙 '+me.resources.gold:'';
    powerStatus.textContent=me?'Edad '+me.age+' · Poder Militar '+me.pm+' · Tecnologías: '+(me.techs.join(', ')||'ninguna'):'';
    const market=m.market??{food:0,wood:0,stone:0};
    if(me){
      const price={food:{buy:[2,3,4,5,6],sell:[1,1,2,3,4]},wood:{buy:[3,4,5,6,7],sell:[1,2,3,4,5]},stone:{buy:[4,5,6,7,8],sell:[2,3,4,5,6]}} as const;
      resourcesDisplay.textContent+=' | Mercado (compra/venta): '+(['food','wood','stone'] as const).map((res,i)=>['🥩','🪵','🪨'][i]+' '+price[res].buy[market[res]]+'/'+price[res].sell[market[res]]).join(' · ');
    }
    for(const id of ['action-produce','action-move','action-build','action-trade','action-train','action-tech','action-age','action-pass']){
      const btn=document.getElementById(id) as HTMLButtonElement;
      const required=id==='action-tech'?1:id==='action-age'?2:0;
      btn.disabled=!active||(id!=='action-pass'&&m.phase!==required);
      btn.hidden=id!=='action-pass'&&m.phase!==required;
    }
    optionsPanel.hidden=!active||!['build','research','trade'].includes(actionMode??'');
    carryPanel.hidden=true;
    trainPanel.hidden=!active||actionMode!=='train';
    tradeFields.hidden=actionMode!=='trade';
    const mat=(matData as unknown as Record<string,{buildings:{name:string;cost:Partial<Record<string,number>>}[];nodes:{age:string;building:string;type:string;title:string;cost:Partial<Record<string,number>>}[]}>)[['britones','francos','vikingos','persas'][map.civs?.[mySeat]??0]];
    const ageOrder=['dark','feudal','castles','imperial'];
    const allowedTechs=new Set(['Telar','Carretilla','Doble Filo','Pastoreo','Rot. de Cultivos','Recolección','Canteros','Minería Imperial','Qanats','Canteros Reales','Explotac. Aurífera','Administración Real','Carreta Mercante']);
    const available=mat.nodes.filter(n=>n.type==='tech'&&allowedTechs.has(n.title)&&ageOrder.indexOf(n.age)<=(me?.age??1)-1&&!me?.techs.includes(n.title));
    const techOptions=available.map(n=>n.title);
    const opts=actionMode==='build'?['Campamento Productivo','Granja','Cuartel','Torre','Puerto'].filter(name=>name==='Granja'||mat.buildings.some(b=>b.name===name)):actionMode==='trade'?['food','wood','stone']:techOptions;
    const previous=optionSelect.value;
    const costs:Record<string,string>={
      'Campamento Productivo':'🪵 3','Granja':'🪵 2',
      'Cuartel':'🪵 1 · 🪨 3 · 🪙 1','Torre':'🪵 2 · 🪨 3',
      'Puerto':'🪵 4 · 🪨 2','Telar':'🥩 1 · 🪵 1',
      'Carretilla':'🪵 1 · 🪙 1','Doble Filo':'🥩 1 · 🪨 1 · 🪙 1'
    };
    optionSelect.replaceChildren(...opts.map(v=>{
      const o=document.createElement('option');o.value=v;
      o.textContent=({food:'Comida',wood:'Madera',stone:'Piedra'} as Record<string,string>)[v]??v;
      const sourceCost=available.find(n=>n.title===v)?.cost??mat.buildings.find(n=>n.name===v)?.cost??(v==='Granja'?mat.nodes.find(n=>n.title==='Granja'&&n.type==='building')?.cost:undefined);
      const label=sourceCost?Object.entries(sourceCost).map(([k,n])=>({food:'🥩',wood:'🪵',stone:'🪨',gold:'🪙'} as Record<string,string>)[k]+n).join(' · '):costs[v];
      if(label)o.textContent+=' — '+label;
      return o;
    }));
    if(opts.includes(previous))optionSelect.value=previous;
    const phaseInstructions=[
      'Elegí Producir, Mover, Construir, Entrenar o Comerciar; también podés pasar.',
      'Investigá una de las tecnologías disponibles o pasá a la fase militar.',
      'Podés avanzar de Edad si cumplís los requisitos, o finalizar tu turno.'
    ];
    const help:Record<string,string>={
      produce:'Elegí los hexágonos controlados que querés activar para producir.',
      move:'Elegí un aldeano, tocá su destino y después elegí el SEGUNDO aldeano y su destino. Confirmá una sola vez ambos movimientos. Carretilla habilita transportar recursos.',
      build:'Elegí edificio y tocá un hexágono válido donde pueda construir un Aldeano.',
      train:'Elegí la cantidad que puedas pagar. Cada Aldeano cuesta 1 comida y se entrena en el CU.',
      trade:'Comprá o vendé hasta dos recursos; el precio varía para toda la partida.',
      research:'Elegí una tecnología disponible, comprobá su costo y confirmá.',
      age:'Avanzá de Edad si tenés recursos y cumplís los requisitos de construcción.'
    };
    actionHelp.textContent=!active?'Esperando al jugador activo.':actionMode?help[actionMode]:phaseInstructions[m.phase];
    unitList.replaceChildren();
    if(actionMode==='move'&&active){
      const owned=m.units.filter(u=>u.seat===mySeat);
      const guide=document.createElement('p');guide.textContent='Movimientos preparados: '+movePlans.length+'/2. '+(movePlans.length===0?'Elegí el primer aldeano.':movePlans.length===1?'Elegí otro aldeano y tocá su destino antes de confirmar.':'Ya podés confirmar ambos movimientos.');unitList.append(guide);
      for(const [index,u] of owned.entries()){
        const assigned=movePlans.find(p=>p.unit===u.id);
        const button=document.createElement('button');button.className='secondary';
        button.textContent='Aldeano '+(index+1)+' ('+u.q+','+u.r+')'+(assigned?' → '+assigned.q+','+assigned.r:selectedUnits.includes(u.id)?' · Seleccionado':'');
        button.disabled=!assigned&&movePlans.length>=2;
        button.addEventListener('click',()=>{selectedUnits=[u.id];renderMap(sharedMap)});
        unitList.append(button);
      }
      for(const [index,plan] of movePlans.entries()){
        const unit=m.units.find(u=>u.id===plan.unit)!;
        const row=document.createElement('div');row.className='move-plan';
        const label=document.createElement('strong');label.textContent='Movimiento '+(index+1)+' · ('+unit.q+','+unit.r+') → ('+plan.q+','+plan.r+')';row.append(label);
        const stock=m.stock?.[unit.q+','+unit.r]??{};
        if(!me?.techs.includes('Carretilla')){
          const notice=document.createElement('small');notice.textContent='Investigá Carretilla para transportar recursos.';row.append(notice);
        }
        for(const [i,res] of (me?.techs.includes('Carretilla')?resourceTypes:[]).entries()){
          const field=document.createElement('label');field.textContent=['🥩','🪵','🪨','🪙'][i]+' (hay '+(stock[res]??0)+')';
          const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.style.width='72px';
          input.value=String(plan.cargo[res]??0);
          input.addEventListener('change',()=>{plan.cargo[res]=Math.max(0,Math.floor(Number(input.value)||0))});
          field.append(input);row.append(field);
        }
        const remove=document.createElement('button');remove.className='secondary';remove.textContent='Quitar';
        remove.addEventListener('click',()=>{movePlans=movePlans.filter(p=>p.unit!==plan.unit);renderMap(sharedMap)});
        row.append(remove);unitList.append(row);
      }
    }
    selectedDisplay.textContent=actionMode==='move'?movePlans.map((p,i)=>(i+1)+'. ('+p.q+','+p.r+')').join(' · '):selectedHexes.map(p=>'('+p.q+','+p.r+')').join(' · ');
    if(inspectedHex){
      const pos=inspectedHex;
      const terrain=map.hexes.find(h=>h.q===pos.q&&h.r===pos.r);
      const cu=map.centers?.find(p=>p.q===pos.q&&p.r===pos.r);
      const at=m.units.filter(u=>u.q===pos.q&&u.r===pos.r);
      const buildings=m.buildings.filter(b=>b.q===pos.q&&b.r===pos.r);
      const stock=m.stock?.[pos.q+','+pos.r]??{};
      hexInfo.textContent=(terrain?.type??(cu?'Centro Urbano':'Casilla exterior'))+
        ' ('+pos.q+','+pos.r+') · Aldeanos: '+at.length+
        (buildings.length?' · '+buildings.map(b=>b.kind).join(', '):'')+
        ' · Recursos aquí: '+(['food','wood','stone','gold'] as const).map((resource,i)=>['🥩','🪵','🪨','🪙'][i]+' '+(stock[resource]??0)).join(' ');
    }else hexInfo.textContent='Tocá un hexágono para ver sus detalles.';
    submitAction.textContent=actionMode==='move'?'Confirmar '+movePlans.length+' movimiento'+(movePlans.length===1?'':'s'):'Confirmar acción';
    submitAction.hidden=!active||!actionMode||(actionMode==='produce'&&!selectedHexes.length)||(actionMode==='move'&&!movePlans.length)||(actionMode==='build'&&!selectedHexes.length)||(actionMode==='research'&&!opts.length);
    logDisplay.replaceChildren(...m.log.slice(0,12).map(line=>{const li=document.createElement('li');li.textContent=line;return li}));
  }
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
  const chooseFirst=!!map?.draft&&placed.length<2&&map.draft.seat===mySeat;
  firstVillagerSelect.hidden=!chooseFirst;
  if(chooseFirst&&map){
    const choices=map.hexes.filter(h=>!h.type.startsWith('Agua')&&Math.max(Math.abs(h.q-map.draft!.q),Math.abs(h.r-map.draft!.r),Math.abs(h.q+h.r-map.draft!.q-map.draft!.r))===1);
    const previous=firstVillagerSelect.value;
    firstVillagerSelect.replaceChildren(...choices.map(h=>{const opt=document.createElement('option');opt.value=h.q+','+h.r;opt.textContent='Aldeano: '+h.type+' ('+h.q+','+h.r+')';return opt}));
    if(choices.some(h=>h.q+','+h.r===previous))firstVillagerSelect.value=previous;
    cuInfo.textContent='Elegí dónde colocar tu único Aldeano inicial (adyacente al CU) antes de confirmar.';
  }
  confirmCu.hidden=map?.draft?.seat!==mySeat;confirmCu.disabled=map?.draft?.seat!==mySeat;
}
const firstVillagerSelect=document.createElement('select');
firstVillagerSelect.id='first-villager-hex';
firstVillagerSelect.setAttribute('aria-label','Hexágono inicial del primer Aldeano');
confirmCu.parentElement!.insertBefore(firstVillagerSelect,confirmCu);
confirmCu.addEventListener('click',()=>{
  const selected=firstVillagerSelect.value.split(',').map(Number);
  socket?.send(JSON.stringify({type:'confirm_cu',...(firstVillagerSelect.hidden?{}:{q:selected[0],r:selected[1]})}));
});
generate.addEventListener('click',()=>socket?.send(JSON.stringify({type:'generate',count:Number((document.getElementById('count') as HTMLSelectElement).value)})));
startGame.addEventListener('click',()=>socket?.send(JSON.stringify({type:'start_game'})));
document.getElementById('fullscreen')!.addEventListener('click', async () => {
  if (!document.fullscreenElement) await document.body.requestFullscreen();
  else await document.exitFullscreen();
});
let reconnectTimer:ReturnType<typeof setTimeout>|undefined;
let reconnectAttempts=0;
let lastRoom='';
let lastToken='';
let lastName='';
let manualConnection=false;
function scheduleReconnect(){
  if(!lastRoom||!lastToken||reconnectTimer||document.hidden||!navigator.onLine)return;
  const delay=Math.min(12000,600*Math.pow(1.7,Math.min(reconnectAttempts++,6)));
  status.textContent='Reconectando…';
  reconnectTimer=setTimeout(()=>{reconnectTimer=undefined;connectToRoom(true)},delay);
}
function connectToRoom(reconnect=false){
  if(socket&&(socket.readyState===WebSocket.CONNECTING||socket.readyState===WebSocket.OPEN))return;
  if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=undefined}
  const code=reconnect?lastRoom:roomCodeInput.value.trim().toUpperCase();

  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    status.textContent = 'Código de sala inválido'; return;
  }
  const name = reconnect?lastName:((document.getElementById('name') as HTMLInputElement).value.trim() || 'Jugador');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Identidad estable por sala para recuperar civilización, orden y CU.
  const tokenKey='aoe-player-'+code;
  const suppliedToken=restoreInput.value.trim();
  if(suppliedToken&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(suppliedToken)){
    status.textContent='Código de recuperación inválido';return;
  }
  const token=reconnect?lastToken:(suppliedToken||localStorage.getItem(tokenKey)||crypto.randomUUID());
  lastRoom=code;lastToken=token;lastName=name;
  const ws = new WebSocket(`${protocol}//${location.host}/ws/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}&token=${encodeURIComponent(token)}`);
  socket = ws;
  recoveryCode.value=token;
  connectionOpened = false;
  connectionError = '';
  join.disabled = true;
  status.textContent = 'Conectando…';
  ws.onopen = () => {
    if(socket!==ws)return;
    reconnectAttempts=0;
    connectionOpened = true;
    status.textContent = 'Conectado';
    renderMap(sharedMap);
    roomLabel.textContent = 'Sala: ' + code;
    history.replaceState(null, '', '?sala=' + encodeURIComponent(code));
  };
  ws.onmessage = event => {
    if(socket!==ws)return;
    try {
      const packet = JSON.parse(String(event.data));
      if (packet.type === 'welcome') { localStorage.setItem(tokenKey,token);restoreInput.value='';recoveryCode.value=token;playerId = packet.id; mySeat=packet.seat; (game.scene.getScene('BootScene') as BootScene).setSeat(mySeat); renderMap(sharedMap); }
      if (packet.type === 'seat') {mySeat=packet.seat;(game.scene.getScene('BootScene') as BootScene).setSeat(mySeat);renderMap(sharedMap)}
      if (packet.type === 'map'){if(packet.map?.match?.turn!==sharedMap?.match?.turn||packet.map?.match?.phase!==sharedMap?.match?.phase){selectedHexes=[];selectedUnits=[];movePlans=[];actionMode=null}renderMap(packet.map)}
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
    if(socket!==ws)return;
    connectionError = 'No fue posible establecer WebSocket con Cloudflare.';
    status.textContent = 'Error de conexión';
    roomLabel.textContent = connectionError;
  };
  ws.onclose = () => {
    if(socket!==ws)return;
    connectionOpened=false;
    socket=undefined;
    join.disabled=false;
    // Conservar identidad, sala, mapa y partida mientras Android suspende Firefox.
    // El servidor sigue siendo autoritativo y reenvía el mapa al reconectar.
    status.textContent='Sin conexión · se recuperará la partida';
    renderMap(sharedMap);
    scheduleReconnect();

  };
}
join.addEventListener('click',()=>connectToRoom(false));
function resumeConnection(){
  if(document.hidden)return;
  if(socket?.readyState===WebSocket.OPEN){
    // Solicitar el estado más reciente, incluso si Android mantuvo un socket zombi.
    socket.send(JSON.stringify({type:'sync'}));
    return;
  }
  if(socket?.readyState===WebSocket.CONNECTING)return;
  if(lastRoom&&lastToken){reconnectAttempts=0;connectToRoom(true)}
}
document.addEventListener('visibilitychange',resumeConnection);
window.addEventListener('pageshow',resumeConnection);
window.addEventListener('online',resumeConnection);
window.addEventListener('focus',resumeConnection);
window.addEventListener('beforeunload',()=>{if(reconnectTimer)clearTimeout(reconnectTimer);socket?.close()});
// Si Firefox descarta la pestaña por falta de memoria, recuperar la sala desde la URL.
if(suppliedRoom){
  const saved=localStorage.getItem('aoe-player-'+suppliedRoom.toUpperCase());
  if(saved){lastRoom=suppliedRoom.toUpperCase();lastToken=saved;lastName=(document.getElementById('name') as HTMLInputElement).value.trim()||'Jugador';connectToRoom(true)}
}
