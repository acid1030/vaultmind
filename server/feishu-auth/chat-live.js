'use strict';
const crypto = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

function createChatLive(server, path, now = Date.now) {
  const tickets = new Map(), rooms = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 192 * 1024, perMessageDeflate: false });
  function issue(openId, vaultId) {
    for (const [id, grant] of tickets) if (grant.until <= now()) tickets.delete(id);
    if (tickets.size >= 1000 || !/^[0-9a-f-]{36}$/i.test(vaultId)) throw new Error('Invalid live channel');
    const id = crypto.randomBytes(32).toString('base64url');
    const room = JSON.stringify([openId, vaultId]);
    tickets.set(id, { room, until: now() + 30000 });
    return id;
  }
  server.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return socket.destroy(); }
    const id = url.searchParams.get('ticket');
    const grant = tickets.get(id);
    if (url.pathname !== path || !grant || grant.until <= now() || wss.clients.size >= 1000 || rooms.get(grant.room)?.size >= 16) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    tickets.delete(id);
    wss.handleUpgrade(req, socket, head, ws => {
      const peers = rooms.get(grant.room) || new Set();
      rooms.set(grant.room, peers);
      peers.add(ws);
      let last = -Infinity, windowStart = now(), sent = 0, alive = true;
      ws.send('live-v1');
      ws.on('pong', () => { alive = true; });
      ws.on('error', () => ws.terminate());
      ws.on('message', (data, binary) => {
        if (binary) return;
        const frame = data.toString(), time = now();
        if (frame === 'changed') {
          if (time - last < 500) return;
          last = time;
        } else if (frame.startsWith('text-v1:')) {
          if (time - windowStart >= 1000) { windowStart = time; sent = 0; }
          if (++sent > 8) return;
        } else return;
        for (const peer of peers) {
          if (peer !== ws && peer.readyState === WebSocket.OPEN && peer.bufferedAmount < 192 * 1024) peer.send(frame);
        }
      });
      const heartbeat = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        ws.ping();
      }, 15000);
      // Periodically re-verify the Feishu access token on reconnection.
      const expiry = setTimeout(() => ws.close(1000), 10 * 60 * 1000);
      ws.on('close', () => {
        clearInterval(heartbeat);
        clearTimeout(expiry);
        peers.delete(ws);
        if (!peers.size) rooms.delete(grant.room);
      });
    });
  });
  server.on('close', () => {
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  });
  return { issue };
}

module.exports = { createChatLive };
