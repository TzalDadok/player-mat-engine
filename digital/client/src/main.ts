import Phaser from 'phaser';
import './style.css';

const container = document.getElementById('app')!;
container.innerHTML = `
<header><div><strong>AoE BoardGame <span class="tag">Digital · Hito 1</span></strong><br/><small>Cliente web + servidor multijugador</small></div>
<div class="controls"><input id="name" aria-label="Nombre del jugador" maxlength="24" placeholder="Nombre del jugador" value="Jugador"/><button id="join">Entrar a sala</button><button id="fullscreen" class="secondary">⛶ Pantalla completa</button></div><span id="status">Sin conectar</span></header>
<main><section class="stage"><div id="game"></div></section><aside><h2>Sala multijugador</h2><p id="room">Todavía no hay una sala conectada.</p><h2>Jugadores conectados</h2><ol id="players"></ol><hr/><p>Hito 1: base gráfica y conexión. No hay reglas, mapas generados ni bots todavía.</p><small>El mapa procedural y la elección de CU sobre el perímetro se implementarán en el siguiente hito.</small></aside></main>`;

const status = document.getElementById('status')!;
const roomLabel = document.getElementById('room')!;
const players = document.getElementById('players')!;
const join = document.getElementById('join') as HTMLButtonElement;
let socket: WebSocket | undefined;
let playerId = '';
const roomCodeInput = document.createElement('input');
roomCodeInput.id = 'room-code';
roomCodeInput.placeholder = 'Código de sala';
roomCodeInput.value = new URLSearchParams(location.search).get('sala') || 'PRUEBA1';
document.querySelector('header .controls')!.insertBefore(roomCodeInput, join);

class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#172635');
    const g = this.add.graphics();
    g.lineStyle(2, 0xc8b079, .65);
    const cx = width / 2, cy = height / 2, size = 56;
    for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) {
      if (Math.abs(q + r) > 3) continue;
      const x = cx + size * Math.sqrt(3) * (q + r / 2), y = cy + size * 1.5 * r;
      const points: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 6; k++) {
        const angle = Math.PI / 180 * (60 * k - 30);
        points.push(new Phaser.Math.Vector2(x + size * Math.cos(angle), y + size * Math.sin(angle)));
      }
      g.fillStyle((q + r) % 3 === 0 ? 0x344b47 : 0x273d48, 1);
      g.fillPoints(points, true);
      g.strokePoints(points, true);
    }
    this.add.text(cx, 45, 'AoE BoardGame Digital', { fontSize: '29px', color: '#f3e5be', fontStyle:'bold' }).setOrigin(.5);
    this.add.text(cx, height - 46, 'Tablero ilustrativo · Generación procedural en Hito 2', {fontSize:'13px',color:'#d1dbdc'}).setOrigin(.5);
  }
}
const game = new Phaser.Game({type: Phaser.AUTO, parent:'game', backgroundColor:'#172635', scale:{mode:Phaser.Scale.RESIZE, width:'100%', height:'100%'}, scene:[BootScene]});
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
  join.disabled = true;
  status.textContent = 'Conectando…';
  ws.onopen = () => {
    status.textContent = 'Conectado';
    roomLabel.textContent = 'Sala: ' + code;
    history.replaceState(null, '', '?sala=' + encodeURIComponent(code));
  };
  ws.onmessage = event => {
    try {
      const packet = JSON.parse(String(event.data));
      if (packet.type === 'welcome') playerId = packet.id;
      if (packet.type === 'lobby') {
        players.replaceChildren(...packet.players.map((p: { id: string; name: string }) => {
          const li = document.createElement('li');
          li.textContent = p.name + (p.id === playerId ? ' (vos)' : '');
          return li;
        }));
      }
    } catch { /* ignore malformed payload */ }
  };
  ws.onerror = () => { status.textContent = 'Error de conexión'; };
  ws.onclose = () => {
    socket = undefined;
    playerId = '';
    join.disabled = false;
    status.textContent = 'Desconectado';
    players.replaceChildren();
  };
});
window.addEventListener('beforeunload', () => socket?.close());
