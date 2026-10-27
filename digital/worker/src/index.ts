import { DurableObject } from 'cloudflare:workers';

interface Env { GAME_ROOMS: DurableObjectNamespace; ASSETS: Fetcher }
type Member = { id: string; name: string };
type Packet = { type: string; [key: string]: unknown };

export class GameRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    if (this.ctx.getWebSockets().length >= 4) return new Response('Sala llena (4 jugadores)', { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const url = new URL(request.url);
    const name = (url.searchParams.get('name') || 'Jugador').trim().slice(0, 24) || 'Jugador';
    const id = crypto.randomUUID();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, name });
    server.send(JSON.stringify({ type: 'welcome', id, room: url.pathname.slice(4) }));
    this.broadcastLobby();
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcastLobby() {
    const players: Member[] = this.ctx.getWebSockets().map(ws => ws.deserializeAttachment() as Member).filter(Boolean);
    const msg = JSON.stringify({ type: 'lobby', players });
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch {} }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > 1024) return;
    try {
      const packet = JSON.parse(message) as Packet;
      if (packet.type === 'ping') ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
    } catch { /* Invalid client message */ }
  }

  async webSocketClose() { this.broadcastLobby(); }
  async webSocketError() { this.broadcastLobby(); }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ name: 'AoE BoardGame Digital', milestone: 1, status: 'online' });
    if (url.pathname.startsWith('/ws/')) {
      const room = url.pathname.slice(4);
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(room)) return new Response('Código de sala inválido', { status: 400 });
      const id = env.GAME_ROOMS.idFromName(room);
      // Forward the original upgrade request unchanged so Cloudflare preserves the WebSocket handshake.
      return env.GAME_ROOMS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
