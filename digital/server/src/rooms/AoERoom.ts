import { Room, Client } from '@colyseus/core';

type Participant = { id: string; name: string; joinedAt: number };

export class AoERoom extends Room {
  maxClients = 4;
  private participants = new Map<string, Participant>();

  onCreate() {
    this.setMetadata({ title: 'AoE BoardGame · Hito 1', phase: 'lobby' });
    this.onMessage('ping', (client: Client) => {
      client.send('pong', { serverTime: Date.now(), players: this.participants.size });
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const name = String(options?.name || 'Jugador').trim().slice(0, 24) || 'Jugador';
    this.participants.set(client.sessionId, { id: client.sessionId, name, joinedAt: Date.now() });
    this.broadcast('lobby', { players: Array.from(this.participants.values()) });
  }

  onLeave(client: Client) {
    this.participants.delete(client.sessionId);
    this.broadcast('lobby', { players: Array.from(this.participants.values()) });
  }
}
