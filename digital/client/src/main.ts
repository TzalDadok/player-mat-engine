import Phaser from 'phaser';
import './style.css';

const container = document.getElementById('app')!;
container.innerHTML = `
<header><div><strong>AoE BoardGame <span class="tag">Digital · Hito 2</span></strong><br/><small>Cliente web + servidor multijugador</small></div>
<div class="controls"><input id="name" aria-label="Nombre del jugador" maxlength="24" placeholder="Nombre del jugador" value="Jugador"/><button id="join">Entrar a sala</button><button id="fullscreen" class="secondary">⛶ Pantalla completa</button></div><span id="status">Sin conectar</span></header>
<main><section class="stage"><div id="game"></div></section><aside><h2>Sala multijugador</h2><p id="room">Todavía no hay una sala conectada.</p><h2>Jugadores conectados</h2><ol id="players"></ol><hr/><div class="controls"><select id="count" aria-label="Jugadores del mapa"><option value="2">2 jugadores</option><option value="3">3 jugadores</option><option value="4">4 jugadores</option></select><button id="generate" disabled>Generar mapa</button></div><p id="map-info">Mapa todavía no generado.</p><p>Hito 2: mapa procedural compartido. Sin bots ni reglas de combate todavía.</p><small>Los CU se colocarán después de generar el mapa, en nuevos hexágonos exteriores.</small></aside></main>`;

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
type MapState = { seed:number; count:number; hexes:Hex[] };
let sharedMap:MapState|null = null;
const roomCodeInput = document.createElement('input');
roomCodeInput.id = 'room-code';
roomCodeInput.placeholder = 'Código de sala';
roomCodeInput.value = new URLSearchParams(location.search).get('sala') || 'PRUEBA1';
document.querySelector('header .controls')!.insertBefore(roomCodeInput, join);

const terrain: Record<string,{fill:number;label:string}> = {
  'Maravilla':{fill:0xc4a45a,label:'🏛️'},
  'Frutos silvestres':{fill:0x668447,label:'🫐'},'Animales':{fill:0x94a35b,label:'🐑'},
  'Cantera de Oro':{fill:0xb39b47,label:'🪙'},'Cantera de Piedra':{fill:0x828993,label:'🪨'},
  'Bosque':{fill:0x386b48,label:'🌲'},'Agua':{fill:0x36759f,label:'🌊'},
  'Desierto':{fill:0xc9a26c,label:'🏜️'},'Llanura':{fill:0x85a86a,label:'🌱'},
  'Montaña':{fill:0x6b737c,label:'⛰️'}
};
const textures:Record<string,string> = {'Frutos silvestres':'comidaFrutos','Animales':'comidaAnimales','Cantera de Oro':'oro','Cantera de Piedra':'piedra','Bosque':'madera','Desierto':'nadaArena','Llanura':'nadaPasto','Montaña':'montana','Agua':'agua','Maravilla':'maravilla','Centro Urbano':'centroUrbano'};
class BootScene extends Phaser.Scene {
  preload(){for(const name of Object.values(textures))this.load.image(name,'/terrenos/'+name+'.webp');}
  private currentMap: MapState|null = null;
  constructor(){super('BootScene')}
  create(){this.scale.on('resize',()=>this.draw());this.draw()}
  updateMap(map:MapState|null){this.currentMap=map;this.draw()}
  private draw(){
    this.children.removeAll();
    const width=this.scale.width,height=this.scale.height;
    this.cameras.main.setBackgroundColor('#172635');
    if(!this.currentMap){
      this.add.text(width/2,height/2,'Conectate y generá un mapa', {fontSize:'23px',color:'#f3e5be'}).setOrigin(.5);
      return;
    }
    const hexes=this.currentMap.hexes;
    // Compatibilidad con mapas viejos: la Maravilla debe ser la única ficha en (0,0).
    const displayHexes=[...hexes.filter(h=>h.q!==0||h.r!==0),{q:0,r:0,type:'Maravilla'}];
    const coords=displayHexes.map(({q,r})=>({x:Math.sqrt(3)*(q+r/2),y:1.5*r}));
    const minX=Math.min(...coords.map(p=>p.x))-1,maxX=Math.max(...coords.map(p=>p.x))+1;
    const minY=Math.min(...coords.map(p=>p.y))-1,maxY=Math.max(...coords.map(p=>p.y))+1;
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
    this.add.text(width/2,20,hexes.length+' terrenos + Maravilla · Semilla '+this.currentMap.seed,{fontSize:'15px',color:'#f3e5be'}).setOrigin(.5,0);
  }
}
const game = new Phaser.Game({type: Phaser.AUTO, parent:'game', backgroundColor:'#172635', scale:{mode:Phaser.Scale.RESIZE, width:'100%', height:'100%'}, scene:[BootScene]});
function renderMap(map:MapState|null){
  sharedMap=map;
  const scene=game.scene.getScene('BootScene') as BootScene;
  if(scene.scene.isActive())scene.updateMap(map);
  mapInfo.textContent=map ? map.hexes.length+' terrenos + Maravilla para '+map.count+' jugadores · Semilla '+map.seed : 'Mapa todavía no generado.';
}
generate.addEventListener('click',()=>socket?.send(JSON.stringify({type:'generate',count:Number((document.getElementById('count') as HTMLSelectElement).value)})));
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
    generate.disabled = false;
    roomLabel.textContent = 'Sala: ' + code;
    history.replaceState(null, '', '?sala=' + encodeURIComponent(code));
  };
  ws.onmessage = event => {
    try {
      const packet = JSON.parse(String(event.data));
      if (packet.type === 'welcome') playerId = packet.id;
      if (packet.type === 'map') renderMap(packet.map);
      if (packet.type === 'error') mapInfo.textContent = packet.message;
      if (packet.type === 'lobby') {
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
    join.disabled = false;
    generate.disabled = true;
    status.textContent = wasOpen ? 'Desconectado' : 'No se pudo conectar';
    roomLabel.textContent = wasOpen ? 'Conexión cerrada: ' + (event.reason || event.code) : (errorText || 'La conexión se cerró antes de abrir (código ' + event.code + ').');
    players.replaceChildren();
  };
});
window.addEventListener('beforeunload', () => socket?.close());
