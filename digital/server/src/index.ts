import http from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { AoERoom } from './rooms/AoERoom.js';

const port = Number(process.env.PORT || 2567);
const httpServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ name: 'AoE BoardGame Digital', milestone: 1, status: 'online' }));
});
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define('aoe_lobby', AoERoom);
gameServer.listen(port).then(() => console.log('AoE Digital server listening on port ' + port));
